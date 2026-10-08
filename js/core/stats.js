// Stats: power rankings, playoff odds, the Wrap (weekly recap) and the Hall of Shame.
// Pure derivations over data.js: no DOM, no storage, no Firebase. Owner: STATS.
// Results are memoized per data load (the cache drops itself when data.reload() swaps data.GAMES),
// and every export returns a fresh copy, so callers may sort or annotate what they get.
// Game objects inside results (`item.game`) are the shared data.GAMES entries: treat them as read-only.
import * as data from './data.js';

// ---------------------------------------------------------------------------
// Helpers

const byNum = (a, b) => a - b;
const cmpId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const f1 = x => r1(x).toFixed(1);                 // 161.98 -> '162.0'
const f2 = x => data.fmt(x);                      // 88.34 -> '88.34'
const n2 = x => Number(x).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}); // 1,470.54
const nm = id => data.name(id);
const winsOf = r => r.w + r.t / 2;

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function andList(a) {
  if (a.length <= 1) return a[0] || '';
  return a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

// Memo, keyed to the current data load.
let memoFor = null;
const memoMap = new Map();
function fresh() {
  if (memoFor !== data.GAMES) { memoMap.clear(); memoFor = data.GAMES; }
}
function memo(key, fn) {
  fresh();
  if (memoMap.has(key)) return memoMap.get(key);
  const v = fn();
  memoMap.set(key, v);
  return v;
}

// ---------------------------------------------------------------------------
// Seasons

function liveSeason() { return data.SEASONS.find(s => s.live) || data.SEASONS[0] || null; }
function seasonOf(year) { return year == null || year === '' ? liveSeason() : data.seasonByYear(year); }
function rawSeason(year) { return ((data.DATA && data.DATA.seasons) || []).find(s => s.year === year) || null; }
function regWeeks(s) { return [...new Set(s.games.filter(g => g.reg).map(g => g.week))].sort(byNum); }

// Per season: every team's regular-season results in week order, and the games of each week.
function seasonIndex(s) {
  return memo('idx|' + s.year, () => {
    const res = {}, byWeek = new Map();
    const add = (g, id, my, their, opp) => (res[id] || (res[id] = [])).push({week: g.week, g, my, their, opp, r: my > their ? 'W' : my < their ? 'L' : 'T'});
    for (const g of s.games) {
      if (!g.reg) continue;
      add(g, g.a, g.sa, g.sb, g.b);
      add(g, g.b, g.sb, g.sa, g.a);
      if (!byWeek.has(g.week)) byWeek.set(g.week, []);
      byWeek.get(g.week).push(g);
    }
    Object.values(res).forEach(a => a.sort((x, y) => x.week - y.week));
    return {res, byWeek, weeks: [...byWeek.keys()].sort(byNum)};
  });
}

// Current streak in a result list, counting only weeks <= week: {type: 'W'|'L'|'T'|null, n}.
function streakAt(list, week) {
  let type = null, n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const x = list[i];
    if (x.week > week) continue;
    if (!type) type = x.r;
    if (x.r !== type) break;
    n++;
  }
  return {type, n};
}

const tableOrder = (x, y) => winsOf(y) - winsOf(x) || y.pf - x.pf || cmpId(x.id, y.id);

// Regular-season table through `week` (inclusive), ordered like data.js: wins (ties half), then points for.
function tableThrough(s, week) {
  const rows = {};
  const row = id => rows[id] || (rows[id] = {id, w: 0, l: 0, t: 0, pf: 0, pa: 0, gp: 0});
  for (const g of s.games) {
    if (!g.reg || g.week > week) continue;
    const A = row(g.a), B = row(g.b);
    A.pf += g.sa; A.pa += g.sb; B.pf += g.sb; B.pa += g.sa; A.gp++; B.gp++;
    if (g.tie) { A.t++; B.t++; } else if (g.win === g.a) { A.w++; B.l++; } else { B.w++; A.l++; }
  }
  const t = Object.values(rows).sort(tableOrder);
  t.forEach((r, i) => { r.seed = i + 1; });
  return t;
}

// ---------------------------------------------------------------------------
// Power rankings
// Score (0..100) = 35% all-play win % + 25% actual win % + 25% points per game + 15% last-3-weeks scoring,
// with both scoring terms scaled across the league (lowest 0, highest 1).

function prCore(s, W) {
  const I = seasonIndex(s);
  const table = tableThrough(s, W);
  if (!table.length) return null;
  const ap = {};
  table.forEach(r => { ap[r.id] = {w: 0, l: 0, t: 0}; });
  for (const w of I.weeks) {
    if (w > W) continue;
    const sc = [];
    for (const g of I.byWeek.get(w)) sc.push([g.a, g.sa], [g.b, g.sb]);
    for (let i = 0; i < sc.length; i++) for (let j = 0; j < sc.length; j++) {
      if (i === j) continue;
      const o = ap[sc[i][0]];
      if (sc[i][1] > sc[j][1]) o.w++; else if (sc[i][1] < sc[j][1]) o.l++; else o.t++;
    }
  }
  const rows = table.map(r => {
    const list = (I.res[r.id] || []).filter(x => x.week <= W);
    const last3 = list.slice(-3);
    const recent = last3.length ? last3.reduce((a, x) => a + x.my, 0) / last3.length : 0;
    const a = ap[r.id], apn = a.w + a.l + a.t;
    return {
      id: r.id, seed: r.seed, w: r.w, l: r.l, t: r.t, pf: r.pf, pa: r.pa, gp: r.gp,
      ppg: r.gp ? r.pf / r.gp : 0, papg: r.gp ? r.pa / r.gp : 0, winPct: r.gp ? winsOf(r) / r.gp : 0,
      allPlay: a, apPct: apn ? (a.w + a.t / 2) / apn : 0, recent, list
    };
  });
  const scale = k => {
    const v = rows.map(x => x[k]), lo = Math.min(...v), hi = Math.max(...v);
    return x => (hi > lo ? (x - lo) / (hi - lo) : .5);
  };
  const sP = scale('ppg'), sR = scale('recent');
  rows.forEach(x => { x.raw = .35 * x.apPct + .25 * x.winPct + .25 * sP(x.ppg) + .15 * sR(x.recent); });
  rows.sort((x, y) => y.raw - x.raw || y.winPct - x.winPct || y.pf - x.pf || cmpId(x.id, y.id));
  rows.forEach((x, i) => { x.rank = i + 1; });
  return rows;
}

function rankMap(rows, key, desc = true) {
  const m = {};
  rows.slice().sort((a, b) => (desc ? b[key] - a[key] : a[key] - b[key]) || cmpId(a.id, b.id)).forEach((x, i) => { m[x.id] = i + 1; });
  return m;
}
// Competition ranks (equal values share the better rank) and how many share each value. For all-play
// records, which tie often: "tied for 3rd", never a tie reported as a place held alone.
function tieRanks(rows, key) {
  const rank = {}, low = {}, n = {};
  rows.forEach(x => {
    rank[x.id] = 1 + rows.filter(y => y[key] > x[key] + 1e-12).length;
    low[x.id] = 1 + rows.filter(y => y[key] < x[key] - 1e-12).length;
    n[x.id] = rows.filter(y => Math.abs(y[key] - x[key]) <= 1e-12).length;
  });
  return {rank, low, n};
}

// Candidate one-liners for a team, each with a kind and a weight (higher = more worth saying).
// tone: +1 good news, -1 bad news. A line that fights the team's rank (bad news for a top-third
// team, good news for a bottom-third one) loses 10, so the reason explains the rank.
function reasonsFor(x, C) {
  const out = [];
  const {N, W} = C;
  const third = N / 3;
  const add = (kind, w, text, tone = 0) => {
    if ((tone < 0 && x.rank <= third) || (tone > 0 && x.rank > N - third)) w -= 10;
    out.push({kind, w, text});
  };
  const rec = data.recStr(x.w, x.l, x.t), apRec = data.recStr(x.allPlay.w, x.allPlay.l, x.allPlay.t);
  const gp = x.gp, ppg = f1(x.ppg);
  const lastR = x.list[x.list.length - 1];
  const last = lastR && lastR.week === W ? lastR : null;
  const opp = last ? nm(last.opp) : '';
  const unbeaten = gp >= 2 && !x.l, winless = gp >= 2 && !x.w;
  const st = streakAt(x.list, W);
  const luck = x.winPct - x.apPct;
  // How far actual and all-play win % must part to call it luck: loose early, .12 by week 11.
  const lt = gp ? Math.max(.12, .4 / Math.sqrt(gp)) : 1;
  const ppgR = C.ppgR[x.id], pfR = C.pfR[x.id], recR = C.recR[x.id], paR = C.paR[x.id];
  const apR = C.ap.rank[x.id], apLow = C.ap.low[x.id], apTied = C.ap.n[x.id] > 1;

  if (ppgR === 1) {
    if (unbeaten) add('top', 96, `${rec} with a league-high ${ppg} a week`, 1);
    else if (x.winPct < .5) add('top', 94, `League-high ${ppg} a week and still ${rec}`);
    else add('top', 90, `League-high ${ppg} a week`, 1);
  }
  if (ppgR === N && N > 1) {
    if (winless) add('bottom', 95, `${rec} on a league-low ${ppg} a week: earned it`, -1);
    else if (x.winPct >= .5) add('bottom', 93, `League-low ${ppg} a week, somehow ${rec}`);
    else add('bottom', 85, `League-low ${ppg} a week`, -1);
  }
  if (gp >= 1 && luck >= lt) {
    if (pfR > N / 2) add('lucky', 70 + 100 * luck, `${rec} on the ${ordinal(pfR)}-most points: living right`);
    else add('lucky', 60 + 100 * luck, `All-play ${apRec}, actual ${rec}: the schedule has been kind`);
  }
  if (gp >= 1 && luck <= -lt) {
    if (apR === 1) add('unlucky', 75 - 100 * luck, `All-play ${apRec}: ${apTied ? 'tied for the best' : 'best'} team, bad luck`);
    // Only a .500-or-better all-play team is mostly unlucky; below that the record is mostly earned.
    else if (x.apPct >= .5) add('unlucky', 65 - 100 * luck, `All-play ${apRec} but ${rec}: bad luck, mostly`);
    else add('unlucky', 55 - 100 * luck, `All-play ${apRec}, actual ${rec}: bad, and unlucky with it`, -1);
  }
  if (gp >= 2 && luck > -lt && luck < lt) {
    const tied = apTied ? 'tied for ' : '';
    if (apR === 1) add('apbest', 78, `All-play ${apRec}, ${apTied ? 'tied for the best' : 'best'} in the league`, 1);
    else if (apR <= 3) add('apgood', 60, `All-play ${apRec}, ${tied}${ordinal(apR)} in the league`, 1);
    else if (apLow === 1) add('apworst', 70, `All-play ${apRec}, ${apTied ? 'tied for the worst' : 'worst'} in the league`, -1);
    else if (Math.abs(x.apPct - .5) <= .06) add('apmid', 35, `All-play ${apRec}: aggressively average`);
  }
  if (unbeaten && C.unbeaten === 1) add('unbeaten', 88, 'The last unbeaten team', 1);
  else if (unbeaten) add('unbeaten', 70, `Unbeaten, ${ordinal(ppgR)} in scoring`, 1);
  if (winless && C.winless === 1) add('winless', 87, 'The only winless team left', -1);
  else if (winless) add('winless', 64, 'Still looking for a first win', -1);
  if (st.type === 'W' && st.n >= 3 && st.n < gp) add('wstreak', 62 + 4 * st.n, `Won ${st.n} straight`, 1);
  if (st.type === 'L' && st.n >= 3 && st.n < gp) add('lstreak', 62 + 4 * st.n, `Lost ${st.n} straight`, -1);
  if (gp >= 4) {
    const d = x.recent - x.ppg;
    if (recR === 1 && d > 0) add('hot', 72 + d / 2, `Hottest team: ${f1(x.recent)} a week over the last 3`, 1);
    else if (d >= 15) add('surge', 60 + d / 2, `Heating up: ${f1(x.recent)} a week over the last 3`, 1);
    if (recR === N && d < 0) add('cold', 70 - d / 2, `Coldest team: ${f1(x.recent)} a week over the last 3`, -1);
    else if (d <= -15) add('slump', 60 - d / 2, `Cooling off: ${f1(x.recent)} a week over the last 3`, -1);
  }
  if (last) {
    const m = Math.abs(last.my - last.their);
    const how = last.r === 'W' ? `after beating ${opp}` : last.r === 'L' ? `despite losing to ${opp}` : `after tying ${opp}`;
    const howDown = last.r === 'L' ? `after losing to ${opp}` : last.r === 'W' ? `despite beating ${opp}` : `after tying ${opp}`;
    // Standings entering the week: a win over a team well above you, or a loss to one well below.
    const me0 = C.entRank[x.id], op0 = C.entRank[last.opp];
    const place = r => (r === N ? 'last-place' : r === 1 ? 'first-place' : `${ordinal(r)}-place`);
    if (me0 && op0 && last.r === 'W' && me0 - op0 >= 4) add('upsetwin', 66, `Knocked off ${place(op0)} ${opp}${m < 3 ? ` by ${f2(m)}` : ''}`);
    if (me0 && op0 && last.r === 'L' && op0 - me0 >= 4) add('upsetloss', 66, `Lost to ${place(op0)} ${opp}${m < 3 ? ` by ${f2(m)}` : ''}`);
    if (last.my === C.hi) add('wkhigh', 70 + Math.max(0, last.my - 150) / 2, `Week ${W} high: ${f2(last.my)} against ${opp}`, 1);
    if (last.my === C.lo) {
      if (last.r === 'W') add('wklow', 80, `Week ${W} low, ${f2(last.my)}, and still beat ${opp}`);
      else add('wklow', 68, `Week ${W} low: ${f2(last.my)} in a loss to ${opp}`, -1);
    }
    if (last.r === 'W' && m >= 40) add('rout', 55 + m / 4, `Beat ${opp} by ${f1(m)} in week ${W}`, 1);
    if (last.r === 'L' && m >= 40) add('routed', 55 + m / 4, `Lost to ${opp} by ${f1(m)} in week ${W}`, -1);
    if (last.r === 'W' && m < 3) add('escape', 58, `Escaped ${opp} by ${f2(m)} in week ${W}`);
    if (last.r === 'L' && m < 3) add('heartbreak', 58, `Lost to ${opp} by ${f2(m)} in week ${W}`);
    if (x.move >= 2) add('rise', 50 + 4 * x.move, `Up ${x.move} spots ${how}`, 1);
    if (x.move <= -2) add('fall', 50 - 4 * x.move, `Down ${-x.move} spots ${howDown}`, -1);
  }
  if (gp >= 2 && paR === 1) add('pa', 64, `Opponents average a league-high ${f1(x.papg)}`);
  if (gp >= 2 && paR === N) add('softpa', 60, `Easiest schedule: opponents average ${f1(x.papg)}`);
  add('base', 10, `${rec}, ${ordinal(pfR)} in points`);
  return out;
}

// One reason per team: repeatedly take the strongest remaining line, with each reuse of a kind
// costing 30, so the list reads as twelve different stories. A joke line (ONCE) is used at most once a
// week. Deterministic.
const ONCE = new Set(['apmid']);
function pickReasons(s, W, rows) {
  const N = rows.length;
  const I = seasonIndex(s);
  const wk = I.byWeek.get(W) || [];
  const scores = wk.flatMap(g => [g.sa, g.sb]);
  const pw = I.weeks.filter(w => w < W).pop();
  const entRank = {};
  if (pw != null) tableThrough(s, pw).forEach(r => { entRank[r.id] = r.seed; });
  const C = {
    N, W, entRank,
    ppgR: rankMap(rows, 'ppg'), pfR: rankMap(rows, 'pf'), ap: tieRanks(rows, 'apPct'),
    recR: rankMap(rows, 'recent'), paR: rankMap(rows, 'papg'),
    hi: scores.length ? Math.max(...scores) : null, lo: scores.length ? Math.min(...scores) : null,
    unbeaten: rows.filter(x => x.gp >= 2 && !x.l).length,
    winless: rows.filter(x => x.gp >= 2 && !x.w).length
  };
  const cands = {};
  rows.forEach(x => { cands[x.id] = reasonsFor(x, C); });
  const used = {}, out = {};
  let left = rows.slice();
  while (left.length) {
    let best = null;
    for (const x of left) for (const c of cands[x.id]) {
      if (ONCE.has(c.kind) && used[c.kind]) continue;
      const eff = c.w - 30 * (used[c.kind] || 0);
      if (!best || eff > best.eff) best = {x, c, eff};
    }
    out[best.x.id] = best.c;
    used[best.c.kind] = (used[best.c.kind] || 0) + 1;
    left = left.filter(x => x !== best.x);
  }
  return out;
}

function buildPR(s, W) {
  const weeks = seasonIndex(s).weeks;
  const cur = prCore(s, W);
  if (!cur) return [];
  const pw = weeks.filter(w => w < W).pop();
  const prev = pw != null ? prCore(s, pw) : null;
  const prevRank = {};
  if (prev) prev.forEach(x => { prevRank[x.id] = x.rank; });
  cur.forEach(x => {
    x.prev = prevRank[x.id] != null ? prevRank[x.id] : null;
    x.move = x.prev == null ? null : x.prev - x.rank;
  });
  const reasons = pickReasons(s, W, cur);
  return cur.map(x => ({
    id: x.id, rank: x.rank, prev: x.prev, move: x.move, score: r1(100 * x.raw),
    w: x.w, l: x.l, t: x.t, pf: r2(x.pf), pa: r2(x.pa), ppg: r2(x.ppg),
    allPlay: {w: x.allPlay.w, l: x.allPlay.l, t: x.allPlay.t}, recent: r2(x.recent),
    reason: reasons[x.id].text, reasonKind: reasons[x.id].kind
  }));
}

// Snap a requested week to the last played regular-season week at or before it (null if none).
function prWeek(s, throughWeek) {
  const weeks = seasonIndex(s).weeks;
  if (!weeks.length) return null;
  if (throughWeek == null || throughWeek === '') return weeks[weeks.length - 1];
  const t = Math.floor(Number(throughWeek));
  const ok = weeks.filter(w => w <= t);
  return ok.length ? ok[ok.length - 1] : null;
}

export function powerRankings(year, throughWeek) {
  const s = seasonOf(year);
  if (!s) return [];
  const W = prWeek(s, throughWeek);
  if (W == null) return [];
  const rows = memo(`pr|${s.year}|${W}`, () => buildPR(s, W));
  return rows.map(r => Object.assign({}, r, {allPlay: Object.assign({}, r.allPlay)}));
}

// ---------------------------------------------------------------------------
// Playoff odds (Monte Carlo over the real remaining schedule)

// Seeded 32-bit generator (mulberry32): returns an unsigned 32-bit integer.
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return (t ^ t >>> 14) >>> 0;
  };
}

// Inverse standard normal CDF (Acklam's rational approximation, relative error < 1.2e-9).
function invNorm(p) {
  const c0 = -7.784894002430293e-03, c1 = -3.223964580411365e-01, c2 = -2.400758277161838e+00, c3 = -2.549732539343734e+00, c4 = 4.374664141464968e+00, c5 = 2.938163982698783e+00;
  const d0 = 7.784695709041462e-03, d1 = 3.224671290700398e-01, d2 = 2.445134137142996e+00, d3 = 3.754408661907416e+00;
  if (p < .02425 || p > .97575) {
    const q = Math.sqrt(-2 * Math.log(p < .5 ? p : 1 - p));
    const x = (((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5) / ((((d0 * q + d1) * q + d2) * q + d3) * q + 1);
    return p < .5 ? x : -x;
  }
  const q = p - .5, r = q * q;
  return (((((-3.969683028665376e+01 * r + 2.209460984245205e+02) * r - 2.759285104469687e+02) * r + 1.383577518672690e+02) * r - 3.066479806614716e+01) * r + 2.506628277459239e+00) * q
    / (((((-5.447609879822406e+01 * r + 1.615858368580409e+02) * r - 1.556989798598866e+02) * r + 6.680131188771972e+01) * r - 1.328068155288572e+01) * r + 1);
}

// 65,536 standard-normal quantiles, rescaled to exactly unit variance. One 32-bit draw gives two
// independent normals (its high and low 16 bits), about 10x faster than Box-Muller.
let ZT = null;
function normalTable() {
  if (ZT) return ZT;
  const n = 65536, t = new Float64Array(n);
  let ss = 0;
  for (let i = 0; i < n; i++) { t[i] = invNorm((i + .5) / n); ss += t[i] * t[i]; }
  const k = 1 / Math.sqrt(ss / n);
  for (let i = 0; i < n; i++) t[i] *= k;
  ZT = t;
  return t;
}

// Pooled within-week SD of regular-season scores over the given seasons (the league's weekly spread: every
// score against that week's league average), with its degrees of freedom.
function weekPooled(seasons) {
  let ss = 0, df = 0;
  for (const s of seasons) {
    const I = seasonIndex(s);
    for (const w of I.weeks) {
      const v = I.byWeek.get(w).flatMap(g => [g.sa, g.sb]);
      if (v.length < 2) continue;
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      v.forEach(x => { ss += (x - m) * (x - m); });
      df += v.length - 1;
    }
  }
  return {sd: df > 0 ? Math.sqrt(ss / df) : null, df};
}

// Pooled within-team SD and mean of regular-season scores over the given seasons.
function pooled(seasons) {
  let ss = 0, df = 0, sum = 0, cnt = 0;
  for (const s of seasons) {
    const I = seasonIndex(s);
    for (const id of Object.keys(I.res)) {
      const v = I.res[id].map(x => x.my);
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      v.forEach(x => { ss += (x - m) * (x - m); sum += x; cnt++; });
      df += v.length - 1;
    }
  }
  return {sd: df > 0 ? Math.sqrt(ss / df) : null, df, avg: cnt ? sum / cnt : null, n: cnt};
}

function oddsPrep(s) {
  const raw = rawSeason(s.year);
  const weeks = regWeeks(s);
  const tw = weeks.length ? weeks[weeks.length - 1] : 0;
  const played = new Set(s.games.filter(g => g.reg).map(g => g.week + '|' + [g.a, g.b].sort().join('|')));
  const sched = ((raw && raw.schedule) || []).filter(g => g && g.week > tw && g.a !== g.b && data.M[g.a] && data.M[g.b]
    && !played.has(g.week + '|' + [g.a, g.b].sort().join('|')));
  const idSet = new Set(s.table.map(r => r.id));
  sched.forEach(g => { idSet.add(g.a); idSet.add(g.b); });
  const ids = [...idSet].sort(cmpId);
  const n = ids.length, ix = {};
  ids.forEach((id, i) => { ix[id] = i; });
  const baseW = new Float64Array(n), basePF = new Float64Array(n), gp = new Float64Array(n), rem = new Float64Array(n);
  const cur = {};
  s.table.forEach(r => { const i = ix[r.id]; baseW[i] = winsOf(r); basePF[i] = r.pf; gp[i] = r.w + r.l + r.t; cur[r.id] = r; });
  const ga = new Int32Array(sched.length), gb = new Int32Array(sched.length);
  sched.forEach((g, k) => { ga[k] = ix[g.a]; gb[k] = ix[g.b]; rem[ix[g.a]]++; rem[ix[g.b]]++; });

  // League scoring: this season's average. The spread is the league's pooled within-week SD (contract), from
  // this season once it has 12+ degrees of freedom, else from past seasons.
  const here = pooled([s]);
  const past = pooled(data.SEASONS.filter(x => x.year !== s.year));
  const leagueAvg = here.n ? here.avg : (past.n ? past.avg : 100);
  const wHere = weekPooled([s]), wPast = weekPooled(data.SEASONS.filter(x => x.year !== s.year));
  const sd = wHere.df >= 12 ? wHere.sd : (wPast.sd || wHere.sd || here.sd || past.sd || 25);
  const mu = new Float64Array(n), muSd = new Float64Array(n);
  ids.forEach((id, i) => {
    const k = gp[i];
    mu[i] = k ? (k * (basePF[i] / k) + 3 * leagueAvg) / (k + 3) : leagueAvg;
    // A team's true level is only known to within sd / sqrt(games + 3) (the same 3-game prior as the shrink):
    // each simulated season draws it once, so early-season odds keep honest tails.
    muSd[i] = sd / Math.sqrt(k + 3);
  });

  // Bracket games already played (only meaningful once the regular season is over).
  const actual = new Map();
  if (!sched.length) {
    s.games.filter(g => (g.type === 'quarter' || g.type === 'semi' || g.type === 'final') && !g.tie && g.a in ix && g.b in ix)
      .forEach(g => actual.set(g.type + '|' + Math.min(ix[g.a], ix[g.b]) + '|' + Math.max(ix[g.a], ix[g.b]), ix[g.win]));
  }
  return {s, tw, ids, n, ix, baseW, basePF, gp, rem, ga, gb, G: sched.length, mu, muSd, sd, leagueAvg, actual, cur,
    weeksLeft: new Set(sched.map(g => g.week)).size};
}

function oddsEngine(s, sims, seed) {
  const P = oddsPrep(s);
  const {n, baseW, basePF, ga, gb, G, mu: mu0, muSd, sd, actual} = P;
  const next = mulberry32(seed), Z = normalTable();
  const W = new Float64Array(n), PF = new Float64Array(n), ord = new Int32Array(n), seedOf = new Int32Array(n);
  const mu = new Float64Array(n); // this simulated season's true level for each team
  const A = {playoffs: new Float64Array(n), bye: new Float64Array(n), top: new Float64Array(n), title: new Float64Array(n),
    last: new Float64Array(n), w: new Float64Array(n), pf: new Float64Array(n)};
  const nPO = Math.min(6, n), nBye = Math.min(2, n), hasActual = actual.size > 0;
  // x has the better seed; a tie goes to it.
  const play = (type, x, y) => {
    if (hasActual) {
      const hit = actual.get(type + '|' + Math.min(x, y) + '|' + Math.max(x, y));
      if (hit !== undefined) return hit;
    }
    const r = next();
    return mu[y] + sd * Z[r & 65535] > mu[x] + sd * Z[r >>> 16] ? y : x;
  };
  let done = 0;
  function one() {
    W.set(baseW); PF.set(basePF);
    for (let i = 0; i < n; i += 2) {
      const r = next();
      mu[i] = mu0[i] + muSd[i] * Z[r >>> 16];
      if (i + 1 < n) mu[i + 1] = mu0[i + 1] + muSd[i + 1] * Z[r & 65535];
    }
    for (let k = 0; k < G; k++) {
      const a = ga[k], b = gb[k], r = next();
      const sa = mu[a] + sd * Z[r >>> 16], sb = mu[b] + sd * Z[r & 65535];
      PF[a] += sa; PF[b] += sb;
      if (sa > sb) W[a]++; else if (sb > sa) W[b]++; else { W[a] += .5; W[b] += .5; }
    }
    for (let i = 0; i < n; i++) ord[i] = i;
    for (let i = 1; i < n; i++) {
      const v = ord[i];
      let j = i - 1;
      while (j >= 0) {
        const u = ord[j];
        if (W[v] > W[u] || (W[v] === W[u] && (PF[v] > PF[u] || (PF[v] === PF[u] && v < u)))) { ord[j + 1] = u; j--; } else break;
      }
      ord[j + 1] = v;
    }
    for (let i = 0; i < n; i++) { seedOf[ord[i]] = i + 1; A.w[i] += W[i]; A.pf[i] += PF[i]; }
    for (let i = 0; i < nPO; i++) A.playoffs[ord[i]]++;
    for (let i = 0; i < nBye; i++) A.bye[ord[i]]++;
    A.top[ord[0]]++;
    A.last[ord[n - 1]]++;
    if (n >= 6) {
      const q1 = play('quarter', ord[2], ord[5]), q2 = play('quarter', ord[3], ord[4]);
      // Reseed: the 1 seed plays the lowest remaining seed.
      const low = seedOf[q1] > seedOf[q2] ? q1 : q2, high = low === q1 ? q2 : q1;
      const f1w = play('semi', ord[0], low), f2w = play('semi', ord[1], high);
      const champ = seedOf[f1w] <= seedOf[f2w] ? play('final', f1w, f2w) : play('final', f2w, f1w);
      A.title[champ]++;
    } else {
      A.title[ord[0]]++;
    }
  }
  return {
    P,
    step(k) { const end = Math.min(sims, done + k); for (; done < end; done++) one(); return done >= sims; },
    stepFor(ms) { const t0 = performance.now(); while (done < sims) { const end = Math.min(sims, done + 250); for (; done < end; done++) one(); if (performance.now() - t0 >= ms) break; } return done >= sims; },
    result() {
      const rows = P.ids.map((id, i) => {
        const c = P.cur[id] || {w: 0, l: 0, t: 0, pf: 0, seed: null};
        const projW = A.w[i] / sims;
        return {
          id, playoffs: A.playoffs[i] / sims, bye: A.bye[i] / sims, top: A.top[i] / sims, title: A.title[i] / sims, last: A.last[i] / sims,
          projW: r2(projW), projL: r2(P.gp[i] + P.rem[i] - projW), projPF: r2(A.pf[i] / sims),
          seed: c.seed, w: c.w, l: c.l, t: c.t, pf: r2(c.pf)
        };
      });
      rows.sort((a, b) => b.playoffs - a.playoffs || b.title - a.title || b.projW - a.projW || (a.seed || 99) - (b.seed || 99) || cmpId(a.id, b.id));
      return {
        meta: {year: P.s.year, sims, seed, throughWeek: P.tw, remaining: P.weeksLeft, games: P.G, leagueAvg: r2(P.leagueAvg), sd: r2(P.sd)},
        rows
      };
    }
  };
}

function oddsArgs(o) {
  o = o || {};
  const s = seasonOf(o.year);
  const sims = Math.max(1, Math.floor(Number(o.sims)) || 10000);
  const seed = Number.isFinite(Number(o.seed)) && o.seed != null ? Math.floor(Number(o.seed)) | 0 : 1;
  return {s, sims, seed, cache: o.cache !== false, key: s ? `odds|${s.year}|${sims}|${seed}` : ''};
}
const copyOdds = r => ({meta: Object.assign({}, r.meta), rows: r.rows.map(x => Object.assign({}, x))});
const emptyOdds = (sims, seed) => ({meta: {year: null, sims, seed, throughWeek: 0, remaining: 0, games: 0, leagueAvg: 0, sd: 0}, rows: []});

// ---------------------------------------------------------------------------------------------- Projections
// A game's projection from the playoff-odds model (oddsPrep): each team's level is its season scoring average shrunk
// toward the league's (a 3-game prior), the spread the league's pooled week-to-week SD plus how unsure each level
// still is. -> {pa, pb (projected points), winA (0-1, a's chance)} or null (no live season).
let projMemo = null;
function projModel(year) {
  const s = data.SEASONS.find(x => x.year === year) || data.SEASONS.find(x => x.live);
  if (!s) return null;
  if (projMemo && projMemo.src === data.DATA && projMemo.year === s.year) return projMemo;
  const P = oddsPrep(s);
  projMemo = {src: data.DATA, year: s.year, P};
  return projMemo;
}
const erf = x => { // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + .3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
export function projectGame(year, a, b) {
  const m = projModel(year);
  if (!m) return null;
  const {ix, mu, muSd, sd, leagueAvg} = m.P;
  const lvl = id => (id in ix ? [mu[ix[id]], muSd[ix[id]]] : [leagueAvg, sd / Math.sqrt(3)]);
  const [ma, sa] = lvl(a), [mb, sb] = lvl(b);
  const spread = Math.sqrt(2 * sd * sd + sa * sa + sb * sb);
  const z = (ma - mb) / spread;
  return {pa: Math.round(ma * 10) / 10, pb: Math.round(mb * 10) / 10, winA: .5 * (1 + erf(z / Math.SQRT2))};
}

export function playoffOdds(opts) {
  const {s, sims, seed, cache, key} = oddsArgs(opts);
  if (!s) return emptyOdds(sims, seed);
  const run = () => { const E = oddsEngine(s, sims, seed); E.step(sims); return E.result(); };
  return copyOdds(cache ? memo(key, run) : run());
}

// Same numbers as playoffOdds (same engine and RNG), computed in ~8 ms slices so it never janks.
const inflight = new Map();
const yieldToMain = () => new Promise(res => {
  try { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); } catch (_) { setTimeout(res, 0); }
});
export async function playoffOddsAsync(opts) {
  const {s, sims, seed, cache, key} = oddsArgs(opts);
  if (!s) return emptyOdds(sims, seed);
  if (cache) {
    fresh();
    if (memoMap.has(key)) return copyOdds(memoMap.get(key));
    const games = data.GAMES, ik = key;
    if (inflight.has(ik) && inflight.get(ik).games === games) return copyOdds(await inflight.get(ik).p);
    const p = (async () => {
      const E = oddsEngine(s, sims, seed);
      while (!E.stepFor(8)) await yieldToMain();
      const r = E.result();
      if (data.GAMES === games) { fresh(); memoMap.set(key, r); }
      return r;
    })();
    inflight.set(ik, {games, p});
    try { return copyOdds(await p); } finally { if (inflight.get(ik) && inflight.get(ik).p === p) inflight.delete(ik); }
  }
  const E = oddsEngine(s, sims, seed);
  while (!E.stepFor(8)) await yieldToMain();
  return E.result();
}

// ---------------------------------------------------------------------------
// The Wrap (weekly recap)

// Every week of a season that has games (regular season and playoffs), ascending.
export function wrapWeeks(year) {
  const s = seasonOf(year);
  if (!s) return [];
  return [...new Set(s.games.map(g => g.week))].sort(byNum);
}

// League history as of a week: every score and margin (all game types, like the league facts), ascending.
// During the first season on record it is the whole record to date instead, so a week-1 score is never
// called a league record just because nothing came before it.
function histAt(year, week) {
  return memo(`hist|${year}|${week}`, () => {
    const sc = [], mg = [];
    const first = !data.GAMES.some(g => g.year < year);
    for (const g of data.GAMES) {
      if (!first && (g.year > year || (g.year === year && g.week > week))) continue;
      sc.push(g.sa, g.sb);
      if (!g.tie) mg.push(g.margin);
    }
    return {sc: sc.sort(byNum), mg: mg.sort(byNum)};
  });
}
// Counts compare to the cent: margins are float differences (123.60 - 123.56 is not exactly 106.20 - 106.16).
const cents = v => Math.round(v * 100);
const above = (arr, x) => { const c = cents(x); return arr.reduce((k, v) => k + (cents(v) > c ? 1 : 0), 0); };
const below = (arr, x) => { const c = cents(x); return arr.reduce((k, v) => k + (cents(v) < c ? 1 : 0), 0); };
// Rank of x in league history (1 = best/worst ever); Infinity when there is no history to rank against.
const hrank = (arr, x, higher) => (arr.length ? 1 + (higher ? above(arr, x) : below(arr, x)) : Infinity);

// A manager's scores before a given week (all game types).
function priorScores(id, year, week) {
  const out = [];
  for (const g of data.GAMES) {
    if (g.year > year || (g.year === year && g.week >= week)) break;
    if (g.a === id) out.push(g.sa); else if (g.b === id) out.push(g.sb);
  }
  return out;
}

const sidesOf = games => games.flatMap(g => [
  {id: g.a, my: g.sa, their: g.sb, opp: g.b, g},
  {id: g.b, my: g.sb, their: g.sa, opp: g.a, g}
]);

// "The 3rd-highest score in league history." / "Tied for the closest game in league history." ('' past 10th)
function histNote(arr, x, higher, noun) {
  const rank = hrank(arr, x, higher);
  if (rank > 10) return '';
  const c = cents(x), tied = arr.reduce((k, v) => k + (cents(v) === c ? 1 : 0), 0) > 1;
  return ` ${tied ? 'Tied for the' : 'The'} ${rank === 1 ? '' : ordinal(rank) + '-'}${noun} in league history.`;
}

function regWrap(s, W, games) {
  const I = seasonIndex(s);
  const weeks = I.weeks;
  const firstWeek = weeks[0] === W;
  const prevW = weeks.filter(w => w < W).pop();
  const sc = sidesOf(games).sort((x, y) => y.my - x.my || cmpId(x.id, y.id));
  const hi = sc[0], lo = sc[sc.length - 1];
  const H = histAt(s.year, W);
  const seasonSc = [];
  weeks.filter(w => w <= W).forEach(w => I.byWeek.get(w).forEach(g => seasonSc.push(g.sa, g.sb)));
  const items = [], story = [], used = new Set();
  const push = (it) => { items.push(it); if (it.game) used.add(it.game); };
  // A featured game that is also one of the three biggest or closest margins ever says so once.
  let marginSaid = false;
  const marginNote = g => {
    if (marginSaid || g.tie) return '';
    const also = t => t.replace(/^ The /, ' Also the ').replace(/^ Tied /, ' Also tied ');
    if (hrank(H.mg, g.margin, true) <= 3) { marginSaid = true; return also(histNote(H.mg, g.margin, true, 'biggest margin')); }
    if (hrank(H.mg, g.margin, false) <= 3) { marginSaid = true; return histNote(H.mg, g.margin, false, 'closest game'); }
    return '';
  };

  // High score
  {
    const m = hi.my - hi.their;
    let body = m > 0 ? `${nm(hi.id)} put up ${f2(hi.my)} and beat ${nm(hi.opp)} by ${f2(m)}.` : `${nm(hi.id)} put up ${f2(hi.my)} and still only tied ${nm(hi.opp)}.`;
    const ar = hrank(H.sc, hi.my, true);
    const prior = priorScores(hi.id, s.year, W);
    const hn = histNote(H.sc, hi.my, true, 'highest score');
    if (hn) body += hn;
    else if (!firstWeek && above(seasonSc, hi.my) === 0) body += ' Best score of the season.';
    body += marginNote(hi.g);
    if (ar > 1 && prior.length >= 10 && hi.my > Math.max(...prior)) body += ' A career high.';
    else if (prevW != null) {
      const pv = sidesOf(I.byWeek.get(prevW)).sort((x, y) => y.my - x.my)[0];
      if (pv && pv.id === hi.id) body += ' High score two weeks running.';
    }
    push({kind: 'high', title: 'High score', body, ids: [hi.id, hi.opp], game: hi.g});
    story.push({g: hi.g, w: 50 + (ar <= 10 ? (11 - ar) * 5 : 0) + Math.max(0, hi.my - 150) / 2,
      head: ar === 1 ? `${nm(hi.id)} sets a league record with ${f2(hi.my)}` : firstWeek ? `${nm(hi.id)} opens with ${f2(hi.my)}` : `${nm(hi.id)} hangs ${f2(hi.my)} on ${nm(hi.opp)}`});
  }

  // Low score
  {
    const won = lo.my > lo.their, tied = lo.my === lo.their;
    let body = won ? `${nm(lo.id)} managed ${f2(lo.my)} and still beat ${nm(lo.opp)}, who had ${f2(lo.their)}.`
      : tied ? `${nm(lo.id)} managed ${f2(lo.my)} and tied ${nm(lo.opp)} anyway.`
      : `${nm(lo.id)} managed ${f2(lo.my)} and lost to ${nm(lo.opp)} by ${f2(lo.their - lo.my)}.`;
    const lr = hrank(H.sc, lo.my, false);
    const ln = histNote(H.sc, lo.my, false, 'lowest score');
    if (ln) body += ln;
    else if (!firstWeek && below(seasonSc, lo.my) === 0) body += ' Worst of the season so far.';
    if (!won && !tied) {
      const pos = 1 + below(sc.map(x => x.my), lo.their);
      if (pos === 2) body += ` ${nm(lo.opp)} won with the week's second-lowest score.`;
      else if (pos === 3) body += ` ${nm(lo.opp)} won with the week's third-lowest score.`;
    }
    if (lo.g !== hi.g) body += marginNote(lo.g);
    push({kind: 'low', title: 'Low score', body, ids: [lo.id, lo.opp], game: lo.g});
    story.push({g: lo.g, w: 45 + (lr <= 10 ? (11 - lr) * 5 : 0) + Math.max(0, 85 - lo.my) / 2 + (won ? 15 : 0),
      head: lr === 1 ? `${nm(lo.id)} posts the worst score in league history` : won ? `${nm(lo.id)} scores ${f2(lo.my)} and wins anyway`
        : lr <= 10 ? `${nm(lo.id)} bottoms out at ${f2(lo.my)}` : `${nm(lo.id)} limps to ${f2(lo.my)}`});
  }

  // Streak bookkeeping (needed by the upset, which absorbs a streak it ends).
  const ext = {W: [], L: []}, snaps = [];
  sc.forEach(x => {
    const list = I.res[x.id] || [];
    const me = list.find(r => r.week === W);
    if (!me) return;
    const after = streakAt(list, W), before = streakAt(list, W - .5);
    const gp = list.filter(r => r.week <= W).length;
    if ((me.r === 'W' || me.r === 'L') && after.type === me.r && after.n >= 3) ext[me.r].push({x, n: after.n, start: after.n === gp});
    if ((before.type === 'W' || before.type === 'L') && before.n >= 3 && before.type !== me.r) snaps.push({x, n: before.n, type: before.type, start: before.n === gp - 1});
  });

  // Biggest upset: the lower team in the standings entering the week, with a worse record, beat the higher one.
  let upset = null;
  if (!firstWeek && prevW != null) {
    const T = tableThrough(s, prevW), N = T.length;
    const rk = {}, rec = {};
    T.forEach(r => { rk[r.id] = r.seed; rec[r.id] = r; });
    const pct = id => (rec[id] && rec[id].gp ? winsOf(rec[id]) / rec[id].gp : 0);
    const c = games.filter(g => !g.tie && rk[g.win] && rk[g.lose] && rk[g.win] - rk[g.lose] >= 3 && pct(g.win) < pct(g.lose))
      .sort((a, b) => (rk[b.win] - rk[b.lose]) - (rk[a.win] - rk[a.lose]) || b.margin - a.margin || cmpId(a.win, b.win));
    if (c.length) {
      const g = c[0], rW = rk[g.win], rL = rk[g.lose], LW = rec[g.lose], WW = rec[g.win];
      const lUnbeaten = LW.gp >= 2 && !LW.l, wWinless = WW.gp >= 2 && !WW.w;
      let body = `${nm(g.win)} (${ordinal(rW)}) beat ${nm(g.lose)} (${ordinal(rL)}), ${f2(g.ws)} to ${f2(g.ls)}.`;
      if (lUnbeaten && wWinless) body += ` First loss for ${nm(g.lose)}, first win for ${nm(g.win)}.`;
      else if (lUnbeaten) body += ` First loss for ${nm(g.lose)}.`;
      else if (wWinless) body += ` First win for ${nm(g.win)}.`;
      // Streaks this game ended are told here, not again as separate "snapped" items.
      const place = `${rW === N ? 'Last-place' : ordinal(rW) + '-place'} ${nm(g.win)}`;
      let w = 45 + (rW - rL) * 4 + (lUnbeaten ? 8 : 0);
      let head = `${place} knocks off ${lUnbeaten ? 'unbeaten ' : ''}${nm(g.lose)}`;
      const ws = snaps.find(z => z.x.g === g && z.type === 'W'), ls = snaps.find(z => z.x.g === g && z.type === 'L');
      if (ws && !ws.start) {
        body += ` It ended ${nm(g.lose)}'s ${ws.n}-game win streak.`;
        if (50 + ws.n * 4 > w) { w = 50 + ws.n * 4; head = `${place} ends ${nm(g.lose)}'s ${ws.n}-game run`; }
      }
      if (ls && !ls.start) body += ` ${nm(g.win)} had lost ${ls.n} straight.`;
      for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].x.g === g) snaps.splice(i, 1);
      if (g.margin < 5) body += ` Decided by ${f2(g.margin)}.` + histNote(H.mg, g.margin, false, 'closest game');
      upset = {kind: 'upset', title: 'Upset', body, ids: [g.win, g.lose], game: g};
      used.add(g);
      story.push({g, w, head});
    }
  }

  // Blowout and nail-biter: from the games not already featured. When a featured game (high, low, upset) was
  // also the week's biggest margin, its card says so, and a smaller rout only gets a card of its own ("Another
  // rout") when it is big in its own right.
  const byMargin = games.filter(g => !g.tie).sort((a, b) => b.margin - a.margin || cmpId(a.win, b.win));
  const biggest = byMargin[0];
  const bigTaken = !!biggest && used.has(biggest) && biggest.margin >= 25;
  if (bigTaken) {
    const card = items.find(it => it.game === biggest) || (upset && upset.game === biggest ? upset : null);
    if (card && !/biggest margin/.test(card.body)) card.body += " Also the week's biggest margin.";
  }
  const rest = games.filter(g => !used.has(g) && !g.tie);
  const blow = rest.slice().sort((a, b) => b.margin - a.margin || cmpId(a.win, b.win))[0];
  if (blow && (bigTaken ? blow.margin >= 40 || hrank(H.mg, blow.margin, true) <= 10 : blow.margin >= 25)) {
    const mr = hrank(H.mg, blow.margin, true);
    let body = `${nm(blow.win)} beat ${nm(blow.lose)} by ${f2(blow.margin)}, ${f2(blow.ws)} to ${f2(blow.ls)}.`;
    const bn = histNote(H.mg, blow.margin, true, 'biggest margin');
    if (bn) body += bn;
    else if (blow.margin >= 60) body += ' Over by Sunday afternoon.';
    else if (blow.margin >= 40) body += ' Not close.';
    push({kind: 'blowout', title: bigTaken ? 'Another rout' : 'Blowout', body, ids: [blow.win, blow.lose], game: blow});
    story.push({g: blow, w: 40 + Math.max(0, blow.margin - 40) + (mr <= 10 ? (11 - mr) * 3 : 0), head: `${nm(blow.win)} buries ${nm(blow.lose)} by ${f2(blow.margin)}`});
  }
  const tie = games.find(g => g.tie && !used.has(g));
  if (tie) {
    push({kind: 'nail', title: 'Tie', body: `${nm(tie.a)} and ${nm(tie.b)} tied at ${f2(tie.sa)}. Nobody wins.`, ids: [tie.a, tie.b], game: tie});
    story.push({g: tie, w: 70, head: `${nm(tie.a)} and ${nm(tie.b)} settle for a tie`});
  } else {
    const nail = games.filter(g => !used.has(g) && !g.tie).sort((a, b) => a.margin - b.margin || cmpId(a.win, b.win))[0];
    if (nail && nail.margin < 5) {
      const cr = hrank(H.mg, nail.margin, false);
      const body = `${nm(nail.win)} edged ${nm(nail.lose)} ${f2(nail.ws)} to ${f2(nail.ls)}. Decided by ${f2(nail.margin)}.` + histNote(H.mg, nail.margin, false, 'closest game');
      push({kind: 'nail', title: 'Nail-biter', body, ids: [nail.win, nail.lose], game: nail});
      story.push({g: nail, w: 40 + Math.max(0, 3 - nail.margin) * 8 + (cr <= 10 ? (11 - cr) * 3 : 0), head: `${nm(nail.win)} survives ${nm(nail.lose)} by ${f2(nail.margin)}`});
    }
  }
  if (upset) items.push(upset);

  // Streaks extended to 3+ this week, then streaks of 3+ that ended.
  ['W', 'L'].forEach(t => {
    const L = ext[t].sort((a, b) => b.n - a.n || cmpId(a.x.id, b.x.id));
    if (!L.length) return;
    const title = t === 'W' ? (L.length > 1 ? 'Win streaks' : 'Win streak') : (L.length > 1 ? 'Losing streaks' : 'Losing streak');
    const verb = t === 'W' ? 'won' : 'lost';
    let body, game = null;
    if (L.length === 1) {
      const {x, n, start} = L[0];
      const rec = t === 'W' ? data.recStr(n, 0, 0) : data.recStr(0, n, 0);
      game = x.g;
      if (t === 'W') body = start ? `${nm(x.id)} is ${rec}. ${nm(x.opp)} was the latest, ${f2(x.my)} to ${f2(x.their)}.` : `${nm(x.id)} has won ${n} straight, the latest ${f2(x.my)} to ${f2(x.their)} over ${nm(x.opp)}.`;
      else body = start ? `${nm(x.id)} is ${rec}. ${nm(x.opp)} made it ${n} straight, ${f2(x.their)} to ${f2(x.my)}.` : `${nm(x.id)} has lost ${n} straight. ${nm(x.opp)} was the latest, ${f2(x.their)} to ${f2(x.my)}.`;
      story.push({g: x.g, w: 35 + n * 4, head: t === 'W' ? `${nm(x.id)} makes it ${n} straight` : `${nm(x.id)} drops ${n} straight`});
    } else if (L.every(e => e.start && e.n === L[0].n)) {
      const n = L[0].n;
      body = `${andList(L.map(e => nm(e.x.id)))} are each ${t === 'W' ? data.recStr(n, 0, 0) : data.recStr(0, n, 0)}.`;
    } else if (L.every(e => e.n === L[0].n)) {
      body = `${andList(L.map(e => nm(e.x.id)))} have each ${verb} ${L[0].n} straight.`;
    } else {
      body = `${nm(L[0].x.id)} has ${verb} ${L[0].n} straight, ${andList(L.slice(1).map(e => `${nm(e.x.id)} ${e.n}`))}.`;
    }
    items.push({kind: 'streak', title, body, ids: L.map(e => e.x.id), game});
  });
  snaps.sort((a, b) => b.n - a.n || cmpId(a.x.id, b.x.id)).slice(0, 2).forEach(({x, n, type, start}) => {
    let body, head;
    if (type === 'W') {
      body = start ? `${nm(x.opp)} ended ${nm(x.id)}'s unbeaten start at ${data.recStr(n, 0, 0)}, ${f2(x.their)} to ${f2(x.my)}.`
        : `${nm(x.opp)} ended ${nm(x.id)}'s ${n}-game win streak, ${f2(x.their)} to ${f2(x.my)}.`;
      head = start ? `${nm(x.opp)} hands ${nm(x.id)} a first loss` : `${nm(x.opp)} ends ${nm(x.id)}'s ${n}-game run`;
    } else {
      body = start ? `${nm(x.id)} got a first win, ${f2(x.my)} to ${f2(x.their)} over ${nm(x.opp)}. It took ${n + 1} weeks.`
        : `${nm(x.id)} finally won, ${f2(x.my)} to ${f2(x.their)} over ${nm(x.opp)}. The skid ends at ${n}.`;
      head = start ? `${nm(x.id)} gets a first win` : `${nm(x.id)} finally wins`;
    }
    items.push({kind: 'snap', title: 'Streak snapped', body, ids: [x.id, x.opp], game: x.g});
    story.push({g: x.g, w: 50 + n * 4, head});
  });

  // Points leader (skipped in week 1, when it is just the high score)
  if (!firstWeek) {
    const byPf = tableThrough(s, W).sort((a, b) => b.pf - a.pf || cmpId(a.id, b.id));
    const [L1, L2] = byPf;
    if (L1) {
      let body = `${nm(L1.id)} leads the league with ${n2(L1.pf)} points, ${f1(L1.pf / L1.gp)} a week.`;
      if (L2) body += ` ${nm(L2.id)} is ${f2(L1.pf - L2.pf)} back.`;
      const was = prevW != null ? tableThrough(s, prevW).sort((a, b) => b.pf - a.pf || cmpId(a.id, b.id))[0] : null;
      if (was && was.id !== L1.id) body += ` Took the lead from ${nm(was.id)}.`;
      items.push({kind: 'leader', title: 'Points leader', body, ids: [L1.id], game: null});
    }
  }

  // Power-ranking movers (a move of 2 or more)
  if (!firstWeek) {
    const pr = memo(`pr|${s.year}|${W}`, () => buildPR(s, W));
    // Reasons that only restate this week's game or move would repeat the sentence before them.
    const WEEKLY = ['rise', 'fall', 'upsetwin', 'upsetloss', 'rout', 'routed', 'escape', 'heartbreak', 'wkhigh', 'wklow'];
    // A streak reason repeats a streak card this Wrap already has for that team.
    const told = r => WEEKLY.includes(r.reasonKind)
      || ((r.reasonKind === 'wstreak' || r.reasonKind === 'lstreak') && items.some(it => (it.kind === 'streak' || it.kind === 'snap') && it.ids.includes(r.id)));
    const mover = (r, kind, title, verb) => {
      const x = (I.res[r.id] || []).find(z => z.week === W);
      const res = !x ? '' : x.r === 'W' ? ` after beating ${nm(x.opp)} ${f2(x.my)} to ${f2(x.their)}`
        : x.r === 'L' ? ` after losing to ${nm(x.opp)} ${f2(x.their)} to ${f2(x.my)}` : ` after tying ${nm(x.opp)}`;
      const body = `${nm(r.id)} ${verb} ${Math.abs(r.move)} spots to ${ordinal(r.rank)} in the power rankings${res}.` + (told(r) ? '' : ` ${r.reason}.`);
      items.push({kind, title, body, ids: [r.id], game: x ? x.g : null});
    };
    const up = pr.filter(r => r.move >= 2).sort((a, b) => b.move - a.move || a.rank - b.rank)[0];
    const down = pr.filter(r => r.move <= -2).sort((a, b) => a.move - b.move || b.rank - a.rank)[0];
    if (up) mover(up, 'riser', 'Riser', 'climbed');
    if (down) mover(down, 'faller', 'Faller', 'fell');
  }

  return finishWrap(s, W, false, `Week ${W}`, items, story);
}

function playoffWrap(s, W, games) {
  const seed = {};
  s.table.forEach(r => { seed[r.id] = r.seed; });
  const order = ['final', 'semi', 'quarter', 'third'];
  const br = games.filter(g => g.playoff).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || (seed[a.a] || 99) - (seed[b.a] || 99));
  const items = [], story = [];
  const sd = id => (seed[id] ? ` (${seed[id]})` : '');
  br.forEach(g => {
    const W1 = nm(g.win), L1 = nm(g.lose), sc = `${f2(g.ws)} to ${f2(g.ls)}`;
    let body;
    if (g.tie) body = `${nm(g.a)} and ${nm(g.b)} tied at ${f2(g.sa)}.`;
    else if (g.type === 'final') body = `${W1} won the ${s.year} title, beating ${L1} ${sc}.` + (seed[g.win] > seed[g.lose] ? ` The ${seed[g.win]} seed took down the ${seed[g.lose]}.` : '');
    else if (g.type === 'semi') body = `${W1}${sd(g.win)} beat ${L1}${sd(g.lose)}, ${sc}, and plays for the title.`;
    else if (g.type === 'quarter') body = `${W1}${sd(g.win)} beat ${L1}${sd(g.lose)}, ${sc}. ${L1}'s season is over.`;
    else body = `${W1} took third, beating ${L1} ${sc}.`;
    if (!g.tie && g.ls === 0) body += ` ${L1} scored zero.`;
    items.push({kind: 'playoff', title: data.ROUND[g.type] || 'Playoffs', body, ids: g.tie ? [g.a, g.b] : [g.win, g.lose], game: g});
  });
  const fin = br.find(g => g.type === 'final' && !g.tie);
  const semis = br.filter(g => g.type === 'semi' && !g.tie), qs = br.filter(g => g.type === 'quarter' && !g.tie);
  if (fin) story.push({w: 100, head: `${nm(fin.win)} wins the ${s.year} title`});
  else if (semis.length) story.push({w: 100, head: `${andList(semis.map(g => nm(g.win)))} will play for the title`});
  else if (qs.length) story.push({w: 100, head: `${andList(qs.map(g => nm(g.win)))} advance`});

  // High and low of the week, consolation games included (labelled).
  const sc = sidesOf(games).sort((x, y) => y.my - x.my || cmpId(x.id, y.id));
  const where = g => (g.type === 'consol' ? 'in the consolation bracket' : `in the ${(data.ROUND[g.type] || 'playoffs').toLowerCase()}`);
  const top = br.length ? br[0].type : null;
  if (sc.length) {
    const H = histAt(s.year, W);
    const hi = sc[0], lo = sc[sc.length - 1];
    const lr = hrank(H.sc, lo.my, false);
    const lastReg = seasonIndex(s).weeks.slice(-1)[0];
    // A high or low from a bracket game already has its card: its history note goes there instead.
    const cardOf = g => items.find(it => it.kind === 'playoff' && it.game === g);
    const hn = histNote(H.sc, hi.my, true, 'highest score'), ln = histNote(H.sc, lo.my, false, 'lowest score');
    const hc = cardOf(hi.g), lc = cardOf(lo.g);
    if (hc) hc.body += hn;
    else {
      let hb = `${nm(hi.id)} put up ${f2(hi.my)} ${where(hi.g)}.`;
      if (hn) hb += hn;
      else if (hi.g.type === 'consol') {
        // "Where was that in week 14?" only when week 14 went badly for them (a loss); otherwise the season.
        const lr = lastReg ? (seasonIndex(s).res[hi.id] || []).find(z => z.week === lastReg) : null;
        hb += top === 'final' ? ' Nobody was watching.' : top === 'semi' ? ' Too late to matter.'
          : lr && lr.r === 'L' ? ` Where was that in week ${lastReg}?` : ' Where was that in the regular season?';
      }
      items.push({kind: 'high', title: 'High score', body: hb, ids: [hi.id, hi.opp], game: hi.g});
    }
    if (lc) lc.body += ln;
    else items.push({kind: 'low', title: 'Low score', ids: [lo.id, lo.opp], game: lo.g,
      body: `${nm(lo.id)} managed ${f2(lo.my)} ${where(lo.g)}${lo.my < lo.their ? `, losing to ${nm(lo.opp)}` : lo.my > lo.their ? `, and still beat ${nm(lo.opp)}` : ''}.` + ln});
    if (!story.length) story.push({g: hi.g, w: 50, head: `${nm(hi.id)} hangs ${f2(hi.my)} on ${nm(hi.opp)}`});
    if (lr <= 10) story.push({g: lo.g, w: 60, head: `${nm(lo.id)} bottoms out at ${f2(lo.my)}`});
  }
  const label = top === 'final' ? 'Championship week' : top === 'semi' ? 'Semifinal week' : top === 'quarter' ? 'Quarterfinal week' : `Week ${W}`;
  return finishWrap(s, W, true, label, items, story);
}

function finishWrap(s, W, playoff, label, items, story) {
  // Strongest storylines first; one per game, so the headline and dek never tell the same game twice.
  const seen = new Set(), st = [];
  story.map((x, i) => Object.assign({i}, x)).sort((a, b) => b.w - a.w || a.i - b.i).forEach(x => {
    if (x.g && seen.has(x.g)) return;
    if (x.g) seen.add(x.g);
    st.push(x);
  });
  const headline = st.length ? st[0].head : `Week ${W} is in the books`;
  const dek = st.slice(1, 3).map(x => x.head + '.').join(' ');
  const share = [`The Wrap: ${s.year}, ${playoff ? label.toLowerCase() : 'week ' + W}`, headline + '.', '']
    .concat(items.map(it => `${it.title}: ${it.body}`)).join('\n');
  return {year: s.year, week: W, label, playoff, headline, dek, items, share};
}

function buildWrap(s, W) {
  const games = s.games.filter(g => g.week === W);
  if (!games.length) return null;
  const reg = games.filter(g => g.reg);
  return reg.length ? regWrap(s, W, reg) : playoffWrap(s, W, games);
}

// The recap of one week, or null when that week has no games.
export function wrap(year, week) {
  const s = seasonOf(year), W = Math.floor(Number(week));
  if (!s || !Number.isFinite(W)) return null;
  const w = memo(`wrap|${s.year}|${W}`, () => buildWrap(s, W));
  return w ? Object.assign({}, w, {items: w.items.map(it => Object.assign({}, it, {ids: it.ids.slice()}))}) : null;
}

// ---------------------------------------------------------------------------
// Hall of Shame

const TOP = 5;
// The top 5 of an already sorted list, plus anything exactly tied with 5th (never cut one of a tie silently).
function topTies(list, val, k = TOP) {
  if (list.length <= k) return list;
  const cut = val(list[k - 1]);
  let end = k;
  while (end < list.length && end < k + 5 && val(list[end]) === cut) end++;
  return list.slice(0, end);
}

function buildShame(y) {
  const seasons = data.SEASONS.slice().sort((a, b) => a.year - b.year);
  const scoped = y == null ? seasons : seasons.filter(s => s.year === y);
  const tables = y == null ? seasons.filter(s => s.champion) : scoped;   // season totals: completed seasons (or the chosen one)
  const live = y != null && scoped[0] && scoped[0].live;
  const S = yr => data.seasonByYear(yr);
  const holder = (id, year, week, detail) => ({id, year, week, team: data.teamIn(S(year), id), detail});
  const when = g => (g.reg ? `Week ${g.week}, ${g.year}` : `${data.ROUND[g.type] || 'Playoffs'}, ${g.year}`);
  const games = data.GAMES.filter(g => y == null || g.year === y);
  const sections = [];
  const sec = (key, title, note, items) => { if (items.length) sections.push({key, title, note, items}); };

  // Lowest scores
  const sides = sidesOf(games);
  sec('low', 'Lowest scores', 'Every game, consolation bracket included.',
    topTies(sides.slice().sort((a, b) => a.my - b.my || a.g.year - b.g.year || a.g.week - b.g.week || cmpId(a.id, b.id)), x => cents(x.my)).map(x => {
      const res = x.my > x.their ? `Beat ${nm(x.opp)} ${f2(x.my)} to ${f2(x.their)} anyway.`
        : x.my < x.their ? `Lost to ${nm(x.opp)} ${f2(x.their)} to ${f2(x.my)}.` : `Tied ${nm(x.opp)} at ${f2(x.my)}.`;
      return {label: when(x.g), val: f2(x.my), n: x.my, unit: 'points', holders: [holder(x.id, x.g.year, x.g.week, (x.my === 0 ? 'Zero points. ' : '') + res)]};
    }));

  // Biggest blowout losses
  sec('blowout', 'Biggest blowout losses', 'Every game, consolation bracket included.',
    topTies(games.filter(g => !g.tie).sort((a, b) => b.margin - a.margin || a.year - b.year || a.week - b.week), g => cents(g.margin)).map(g => ({
      label: when(g), val: f2(g.margin), n: g.margin, unit: 'points',
      holders: [holder(g.lose, g.year, g.week, `Lost to ${nm(g.win)} ${f2(g.ws)} to ${f2(g.ls)}.`)]
    })));

  // Unluckiest losses and luckiest wins: each score against every other score that regular-season week.
  const unlucky = [], lucky = [];
  scoped.forEach(s => {
    const I = seasonIndex(s);
    I.weeks.forEach(w => {
      const wk = sidesOf(I.byWeek.get(w)), others = wk.length - 1;
      const top = Math.max(...wk.map(x => x.my));
      wk.forEach(x => {
        const beat = wk.reduce((k, o) => k + (o !== x && x.my > o.my ? 1 : 0), 0);
        if (x.my < x.their && beat > others / 2) unlucky.push({x, beat, others, top});
        if (x.my > x.their && beat <= 2) lucky.push({x, beat, others});
      });
    });
  });
  sec('unlucky', 'Unluckiest losses', 'Lost while outscoring most of the league that week.',
    unlucky.sort((a, b) => b.beat - a.beat || b.x.my - a.x.my || cmpId(a.x.id, b.x.id)).slice(0, TOP).map(({x, beat, others, top}) => ({
      label: when(x.g), val: f2(x.my), n: x.my, unit: 'points',
      holders: [holder(x.id, x.g.year, x.g.week, `Beat ${beat} of ${others} other scores that week. Lost to ${nm(x.opp)} ${f2(x.their)} to ${f2(x.my)}.${beat === others - 1 ? ' Would have beaten anyone else.' : x.their === top ? " Ran into the week's high score." : ''}`)]
    })));
  sec('lucky', 'Luckiest wins', 'Won with one of the three lowest scores that week.',
    lucky.sort((a, b) => a.beat - b.beat || a.x.my - b.x.my || cmpId(a.x.id, b.x.id)).slice(0, TOP).map(({x, beat, others}) => ({
      label: when(x.g), val: f2(x.my), n: x.my, unit: 'points',
      holders: [holder(x.id, x.g.year, x.g.week, beat === 1
        ? `Beat 1 of ${others} other scores that week, and it was ${nm(x.opp)}'s. Won ${f2(x.my)} to ${f2(x.their)}.`
        : `Beat ${beat} of ${others} other scores that week. Won ${f2(x.my)} to ${f2(x.their)} over ${nm(x.opp)}.`)]
    })));

  // Longest losing streaks (regular season; all-time they carry across seasons, like the league facts)
  const runs = [];
  const reg = data.GAMES.filter(g => g.reg && (y == null || g.year === y));
  data.ids.forEach(id => {
    let n = 0, from = null, to = null, pts = 0;
    const close = end => { if (n) runs.push({id, n, from, to, pts, end}); n = 0; pts = 0; };
    reg.forEach(g => {
      if (g.a !== id && g.b !== id) return;
      const my = g.a === id ? g.sa : g.sb;
      if (!g.tie && g.lose === id) { if (!n) from = g; n++; to = g; pts += my; }
      else close(g);
    });
    close(null);
  });
  const spanTxt = r => (r.from.year === r.to.year ? `${r.from.year}, weeks ${r.from.week} to ${r.to.week}` : `Week ${r.from.week}, ${r.from.year} to week ${r.to.week}, ${r.to.year}`);
  sec('streak', 'Longest losing streaks', y == null ? 'Regular-season losses in a row, across seasons.' : 'Regular-season losses in a row.',
    topTies(runs.filter(r => r.n >= 2).sort((a, b) => b.n - a.n || a.from.year - b.from.year || a.from.week - b.from.week || cmpId(a.id, b.id)), r => r.n).map(r => {
      const end = !r.end ? ' Still going.' : r.end.tie ? ` Ended with a tie against ${nm(r.end.a === r.id ? r.end.b : r.end.a)}.` : ` Ended by beating ${nm(r.end.lose)} in week ${r.end.week}, ${r.end.year}.`;
      return {label: spanTxt(r), val: String(r.n), n: r.n, unit: 'games', holders: [holder(r.id, r.from.year, r.from.week, `Averaged ${f1(r.pts / r.n)} a week.${end}`)]};
    }));

  // Season totals
  const rows = tables.flatMap(s => s.table.map(r => ({s, r, gp: r.w + r.l + r.t, pct: (r.w + r.l + r.t) ? winsOf(r) / (r.w + r.l + r.t) : 0}))).filter(x => x.gp);
  const rec = r => data.recStr(r.w, r.l, r.t);
  // All-time lists are labelled by season; a one-season list by standings place, which only reads as a rank
  // in "Worst records". The other lists say it is the standings ("2–1 · 5th in the standings").
  const placeLabel = x => `${ordinal(x.r.seed)} of ${x.s.table.length}`;
  const seasonLabel = x => (y == null ? String(x.s.year) : `${rec(x.r)} · ${ordinal(x.r.seed)} in the standings`);
  const soFar = live ? ' So far.' : '';
  sec('worst', y == null ? 'Worst seasons' : 'Worst records', (y == null ? 'Completed seasons, regular season.' : 'Regular season.') + soFar,
    // An equal record is broken by fewer points (the detail line shows them), so this list is cut at 5.
    rows.slice().sort((a, b) => a.pct - b.pct || a.r.pf - b.r.pf || a.s.year - b.s.year).slice(0, TOP).map(x => ({
      label: y == null ? String(x.s.year) : placeLabel(x), val: rec(x.r), n: x.pct, unit: 'record',
      holders: [holder(x.r.id, x.s.year, null, `${n2(x.r.pf)} points, ${f1(x.r.pf / x.gp)} a week.${x.s.lastPlace === x.r.id ? ' Worst record in the league.' : y == null ? ` Finished ${ordinal(x.r.seed)}.` : ''}`)]
    })));
  sec('fewest', y == null ? 'Fewest points in a season' : 'Fewest points', (y == null ? 'Completed seasons, regular season.' : 'Regular season.') + soFar,
    topTies(rows.slice().sort((a, b) => a.r.pf - b.r.pf || a.s.year - b.s.year), x => cents(x.r.pf)).map(x => ({
      label: seasonLabel(x), val: n2(x.r.pf), n: r2(x.r.pf), unit: 'points',
      holders: [holder(x.r.id, x.s.year, null, `${f1(x.r.pf / x.gp)} a week. Went ${rec(x.r)}.`)]
    })));

  // Most last-place ("Worst record") finishes, all-time only
  if (y == null) {
    const lasts = {};
    tables.forEach(s => { if (s.lastPlace) (lasts[s.lastPlace] || (lasts[s.lastPlace] = [])).push(s); });
    // "Most" only once somebody has done it twice.
    const repeat = Object.values(lasts).some(L => L.length > 1);
    sec('last', repeat ? 'Most last-place finishes' : 'Last-place finishes', 'Worst record in the regular season.',
      Object.keys(lasts).sort((a, b) => lasts[b].length - lasts[a].length || lasts[b][lasts[b].length - 1].year - lasts[a][lasts[a].length - 1].year || cmpId(a, b)).map(id => {
        const L = lasts[id];
        return {label: nm(id), val: String(L.length), n: L.length, unit: L.length === 1 ? 'time' : 'times',
          holders: L.slice().reverse().map(s => { const r = s.table.find(t => t.id === id); return holder(id, s.year, null, `${rec(r)}, ${n2(r.pf)} points.`); })};
      }));
  }

  // Playoff flops: a top-2 seed who lost their first playoff game
  const flops = [];
  scoped.forEach(s => {
    s.table.slice(0, 2).forEach(r => {
      const first = s.games.filter(g => (g.type === 'quarter' || g.type === 'semi' || g.type === 'final') && (g.a === r.id || g.b === r.id)).sort((a, b) => a.week - b.week)[0];
      if (first && !first.tie && first.lose === r.id) flops.push({s, r, g: first});
    });
  });
  const seedIn = (s, id) => { const t = s.table.find(x => x.id === id); return t ? t.seed : null; };
  sec('flops', 'Playoff flops', 'Top-2 seeds who lost their first playoff game.',
    flops.sort((a, b) => a.r.seed - b.r.seed || b.g.margin - a.g.margin || a.s.year - b.s.year).map(({s, r, g}) => ({
      label: `${data.ROUND[g.type]}, ${s.year}`, val: String(r.seed), n: r.seed, unit: 'seed',
      holders: [holder(r.id, s.year, g.week, `Went ${rec(r)}${g.type === 'semi' ? ' and earned a bye' : ''}, then lost to ${nm(g.win)}${seedIn(s, g.win) ? ` (${seedIn(s, g.win)})` : ''} ${f2(g.ws)} to ${f2(g.ls)}.`)]
    })));

  // Schedule from hell: most points against
  sec('hell', 'Schedule from hell', 'Most regular-season points against.' + soFar,
    topTies(rows.slice().sort((a, b) => b.r.pa - a.r.pa || a.s.year - b.s.year), x => cents(x.r.pa)).map(x => ({
      label: seasonLabel(x), val: n2(x.r.pa), n: r2(x.r.pa), unit: 'points against',
      holders: [holder(x.r.id, x.s.year, null, `Opponents averaged ${f1(x.r.pa / x.gp)} a week. Went ${rec(x.r)}.${x.s.champion === x.r.id ? ' Won the title anyway.' : x.s.lastPlace === x.r.id ? ' Finished last.' : ''}`)]
    })));

  return {sections};
}

// The league's worst moments. shame() covers every season; shame({year}) covers one season.
export function shame(opts) {
  const yv = opts && opts.year != null && opts.year !== '' ? Number(opts.year) : null;
  if (yv != null && !data.seasonByYear(yv)) return {sections: []};
  const r = memo('shame|' + (yv == null ? 'all' : yv), () => buildShame(yv));
  return {sections: r.sections.map(s => Object.assign({}, s, {items: s.items.map(it => Object.assign({}, it, {holders: it.holders.map(h => Object.assign({}, h))}))}))};
}
