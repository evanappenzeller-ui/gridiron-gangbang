// Stats checks for the dev gallery (#/_kit): js/core/stats.js on the real league data.
// checks.js (owner: CORE) imports statsChecks and calls it with its own check(name, fn) helper;
// every fn here is synchronous and returns true or {pass, detail}. Nothing here writes anything.
// Owner: STATS.

import * as data from './data.js';
import * as stats from './stats.js';

const EPS = 1e-9;
const near = (a, b) => Math.abs(a - b) < EPS;
const liveYear = () => (data.SEASONS.find(s => s.live) || data.SEASONS[0] || {}).year;
const sameOdds = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function statsChecks(check) {
  let err = null;
  try { await data.load(); } catch (e) { err = e; }
  const need = () => { if (err) throw new Error('league did not load: ' + (err.message || err)); };

  // The async variant is awaited here so its check below can stay synchronous.
  let asyncOdds = null, asyncErr = null;
  try { if (!err) asyncOdds = await stats.playoffOddsAsync({sims: 2000, seed: 7, cache: false}); } catch (e) { asyncErr = e; }

  // 1. Power rankings
  check('Power rankings: ranks 1..N every week, movement matches the week before, deterministic', () => {
    need();
    const y = liveYear(), s = data.seasonByYear(y);
    const weeks = [...new Set(s.games.filter(g => g.reg).map(g => g.week))].sort((a, b) => a - b);
    if (!weeks.length) return {pass: true, detail: `${y}: no games yet`};
    const bad = [];
    let prev = null;
    weeks.forEach(w => {
      const pr = stats.powerRankings(y, w);
      const n = s.table.length;
      if (pr.length !== n) bad.push(`wk ${w}: ${pr.length} rows`);
      if (pr.map(r => r.rank).join() !== pr.map((_, i) => i + 1).join()) bad.push(`wk ${w}: ranks not 1..${n}`);
      if (new Set(pr.map(r => r.id)).size !== pr.length) bad.push(`wk ${w}: duplicate ids`);
      pr.forEach((r, i) => {
        if (!(r.score >= 0 && r.score <= 100)) bad.push(`wk ${w}: ${r.id} score ${r.score}`);
        if (i && r.score > pr[i - 1].score) bad.push(`wk ${w}: scores out of order at ${r.rank}`);
        if (!r.reason || /undefined|NaN|!/.test(r.reason)) bad.push(`wk ${w}: ${r.id} reason "${r.reason}"`);
        const was = prev ? prev.find(p => p.id === r.id) : null;
        const want = was ? was.rank : null;
        if (r.prev !== want || r.move !== (want == null ? null : want - r.rank)) bad.push(`wk ${w}: ${r.id} prev ${r.prev} move ${r.move}`);
        const ap = r.allPlay, gp = r.w + r.l + r.t;
        if (ap.w + ap.l + ap.t !== gp * (n - 1)) bad.push(`wk ${w}: ${r.id} all-play ${ap.w}-${ap.l}-${ap.t}`);
      });
      if (JSON.stringify(pr) !== JSON.stringify(stats.powerRankings(y, w))) bad.push(`wk ${w}: not deterministic`);
      prev = pr;
    });
    const last = stats.powerRankings(y);
    const top = last.slice(0, 3).map(r => `${r.rank}. ${data.name(r.id)} ${r.score}`).join(', ');
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 4).join('; ') : `${y}, weeks ${weeks[0]}–${weeks[weeks.length - 1]}: ${top}`};
  });

  // 2. Playoff odds sums
  check('Playoff odds: playoffs sum to 6, byes to 2, titles and Worst record to 1, each 0..1', () => {
    need();
    const t0 = performance.now();
    const o = stats.playoffOdds({sims: 10000, seed: 1, cache: false});
    const ms = performance.now() - t0;
    const sum = k => o.rows.reduce((a, r) => a + r[k], 0);
    const inRange = o.rows.every(r => ['playoffs', 'bye', 'top', 'title', 'last'].every(k => r[k] >= 0 && r[k] <= 1));
    const nest = o.rows.every(r => r.bye <= r.playoffs + EPS && r.top <= r.bye + EPS && r.title <= r.playoffs + EPS);
    const n = o.rows.length, po = Math.min(6, n), by = Math.min(2, n);
    const pass = n > 0 && near(sum('playoffs'), po) && near(sum('bye'), by) && near(sum('top'), 1) && near(sum('title'), 1) && near(sum('last'), 1) && inRange && nest;
    return {pass, detail: `${o.meta.year} through week ${o.meta.throughWeek}, ${o.meta.remaining} weeks left: playoffs ${sum('playoffs').toFixed(3)}, byes ${sum('bye').toFixed(3)}, titles ${sum('title').toFixed(3)}, last ${sum('last').toFixed(3)}; 10,000 sims in ${Math.round(ms)} ms`};
  });

  // 3. Determinism
  check('Playoff odds: same seed, same numbers (sync, cached and async); another seed differs', () => {
    need();
    if (asyncErr) throw asyncErr;
    const a = stats.playoffOdds({sims: 2000, seed: 7, cache: false});
    const b = stats.playoffOdds({sims: 2000, seed: 7});
    const c = stats.playoffOdds({sims: 2000, seed: 7});
    const d = stats.playoffOdds({sims: 2000, seed: 8, cache: false});
    const remaining = a.meta.games > 0;
    const pass = sameOdds(a, b) && sameOdds(b, c) && sameOdds(a, asyncOdds) && (!remaining || !sameOdds(a, d));
    return {pass, detail: `sync = cached: ${sameOdds(a, b)}, sync = async: ${sameOdds(a, asyncOdds)}, seed 8 differs: ${!sameOdds(a, d)}`};
  });

  // 4. A finished season replays what happened
  check('Playoff odds on the last finished season replay what happened', () => {
    need();
    const s = data.DONE[0];
    if (!s) return {pass: true, detail: 'no finished season yet'};
    const o = stats.playoffOdds({year: s.year, sims: 200});
    const get = id => o.rows.find(r => r.id === id) || {};
    const po = o.rows.filter(r => r.playoffs === 1).map(r => r.id).sort();
    const want = s.table.slice(0, 6).map(r => r.id).sort();
    const pass = o.meta.remaining === 0 && get(s.champion).title === 1 && get(s.lastPlace).last === 1
      && get(s.table[0].id).top === 1 && po.join() === want.join() && [...s.playoffTeams].sort().join() === want.join();
    return {pass, detail: `${s.year}: title ${data.name(s.champion)} ${get(s.champion).title}, Worst record ${data.name(s.lastPlace)} ${get(s.lastPlace).last}, playoff teams ${po.map(data.name).join(', ')}`};
  });

  // 5. The Wrap for 2026 week 3
  check('Wrap for 2026 week 3: high and low scores match the data', () => {
    need();
    const y = data.seasonByYear(2026) ? 2026 : liveYear();
    const s = data.seasonByYear(y);
    const wk = data.seasonByYear(2026) && s.games.some(g => g.week === 3 && g.reg) ? 3 : data.throughWeek(s);
    const games = s.games.filter(g => g.week === wk && g.reg);
    if (!games.length) return {pass: true, detail: `${y}: no week ${wk} yet`};
    const sides = games.flatMap(g => [[g.a, g.sa], [g.b, g.sb]]).sort((p, q) => q[1] - p[1]);
    const w = stats.wrap(y, wk);
    const hi = w.items.find(i => i.kind === 'high'), lo = w.items.find(i => i.kind === 'low');
    const fmt = data.fmt;
    const ok = (it, [id, sc]) => it && it.ids[0] === id && it.body.includes(fmt(sc)) && it.game && (it.game.a === id || it.game.b === id);
    const pass = ok(hi, sides[0]) && ok(lo, sides[sides.length - 1]) && !!w.headline && w.share.includes(w.headline);
    return {pass, detail: `${y} week ${wk}: high ${data.name(sides[0][0])} ${fmt(sides[0][1])}, low ${data.name(sides[sides.length - 1][0])} ${fmt(sides[sides.length - 1][1])}. "${w.headline}"`};
  });

  // 6. Every week wraps cleanly
  check('Wrap: every week of every season has a headline and clean items (no "!", NaN or undefined)', () => {
    need();
    const bad = [];
    let n = 0, items = 0;
    data.SEASONS.forEach(s => stats.wrapWeeks(s.year).forEach(wk => {
      const w = stats.wrap(s.year, wk);
      n++;
      if (!w || !w.headline) { bad.push(`${s.year} wk ${wk}: no wrap`); return; }
      const txt = [w.headline, w.dek, w.share].concat(w.items.map(i => i.title + ' ' + i.body)).join(' ');
      if (/undefined|NaN|null|!/.test(txt)) bad.push(`${s.year} wk ${wk}: "${(txt.match(/.{0,30}(undefined|NaN|null|!).{0,10}/) || [''])[0]}"`);
      w.items.forEach(i => { items++; if (!i.kind || !i.title || !i.body || !Array.isArray(i.ids) || !i.ids.length) bad.push(`${s.year} wk ${wk}: bad item ${i.kind}`); });
      if (JSON.stringify(w) !== JSON.stringify(stats.wrap(s.year, wk))) bad.push(`${s.year} wk ${wk}: not deterministic`);
    }));
    return {pass: !bad.length && n > 0, detail: bad.length ? bad.slice(0, 3).join('; ') : `${n} weeks, ${items} items`};
  });

  // 7. Hall of Shame
  check("Hall of Shame: lowest score is Jaymin's 0.00 from 2021 week 17", () => {
    need();
    const sh = stats.shame();
    const low = sh.sections.find(s => s.key === 'low');
    const h = low && low.items[0] && low.items[0].holders[0];
    const shapes = sh.sections.every(s => s.title && s.items.length && s.items.every(it => it.label && it.val != null && it.holders.length
      && it.holders.every(x => data.M[x.id] && x.year && x.team && x.detail && !/undefined|NaN|!/.test(x.detail))));
    const pass = !!h && h.id === 'jaymin' && h.year === 2021 && h.week === 17 && low.items[0].val === '0.00' && shapes && sh.sections.length === 10;
    return {pass, detail: h ? `${data.name(h.id)} ${low.items[0].val}, ${h.year} week ${h.week} (${h.team}); ${sh.sections.length} sections` : 'no lowest score'};
  });
}
