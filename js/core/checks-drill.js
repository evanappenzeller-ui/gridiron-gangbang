// Two-Minute Drill checks for the dev gallery (#/_kit): data/drill.json (the teams' starters and ratings, the days'
// situations), the engine's rules (js/core/drill-sim.js: the clock, the chains, the score, determinism), Survivor's
// spots, the words, and the league scoreboard's rows (on crafted board docs). checks.js (owner: core) imports
// drillChecks and calls it with its own check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here
// writes to storage or the database; the only read is the repo's own data/drill.json. Owner: Drill.

import * as dr from './drill.js';

const E = dr.E;
const OFF = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'];
const DEF = {
  '43': ['LDE', 'LDT', 'RDT', 'RDE', 'WLB', 'MLB', 'SLB', 'LCB', 'RCB', 'SS', 'FS', 'NB'],
  '34': ['LDE', 'NT', 'RDE', 'WLB', 'LILB', 'RILB', 'SLB', 'LCB', 'RCB', 'SS', 'FS', 'NB']
};
const ALL = Object.values(E.ACT);

/** A drive played with seeded random actions (any action, allowed or not, like a careless thumb). */
function randomDrive(sc, seed) {
  const s = E.start(sc, dr.DOC.teams);
  const r = E.dice(seed, 4242);
  const trail = [];
  for (let i = 0; i < 400 && !s.result; i++) {
    const before = {clock: s.clock, tos: s.tos, us: s.us, them: s.them};
    const p = E.act(s, ALL[Math.floor(r() * ALL.length)]);
    if (p) trail.push({before, p, after: {clock: s.clock, tos: s.tos, down: s.down, ball: s.ball, us: s.us, them: s.them}});
  }
  return {s, trail};
}

export async function drillChecks(check) {
  let err = null;
  try { await dr.load(); } catch (e) { err = e; }
  const need = () => { if (err) throw new Error('drill.json did not load: ' + (err.message || err)); };

  // 1. The teams
  check('Drill: all 32 teams have their 11 starters on offense (3WR 1TE), the 12 on defense (base plus nickel) and a kicker, every one named and rated 55-99', () => {
    need();
    const T = dr.DOC.teams, bad = [];
    const ids = Object.keys(T);
    if (ids.length !== 32) bad.push(`${ids.length} teams`);
    ids.forEach(id => {
      const t = T[id];
      if (!t.n || !t.city || !Array.isArray(t.c) || t.c.length !== 2 || !DEF[t.s]) { bad.push(`${id}: name/colours/scheme`); return; }
      if (t.o.map(p => p[0]).join() !== OFF.join()) bad.push(`${id}: offense slots`);
      if (t.d.map(p => p[0]).join() !== DEF[t.s].join()) bad.push(`${id}: defense slots`);
      t.o.concat(t.d, [t.k]).forEach(p => {
        if (typeof p[1] !== 'string' || p[1].length < 3 || !Number.isInteger(p[3]) || p[3] < 55 || p[3] > 99) bad.push(`${id} ${p[0]}: ${p[1]} ${p[3]}`);
        if (p[2] != null && !(Number.isInteger(p[2]) && p[2] >= 0 && p[2] <= 99)) bad.push(`${id} ${p[1]}: jersey ${p[2]}`);
      });
      const names = t.o.concat(t.d).map(p => p[1]);
      if (new Set(names).size !== names.length) bad.push(`${id}: a starter twice`);
    });
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 8).join('; ') : `32 teams, depth charts as of ${dr.DOC.asof}`};
  });

  // 2. The days
  check('Drill: every day is two different teams and a comeback spot (down 1-7, 0:45-3:00 left, the ball between your 10 and their 40, 0-3 timeouts), day 1 on the start date', () => {
    need();
    const D = dr.DOC, bad = [];
    D.days.forEach((d, i) => {
      const deficit = d.them - d.us;
      if (!D.teams[d.o] || !D.teams[d.d] || d.o === d.d) bad.push(`day ${i + 1}: teams`);
      if (!(Number.isInteger(d.us) && deficit >= 1 && deficit <= 7 && d.us >= 0)) bad.push(`day ${i + 1}: score ${d.us}-${d.them}`);
      if (!(Number.isInteger(d.t) && d.t >= 45 && d.t <= 180)) bad.push(`day ${i + 1}: ${d.t}s`);
      if (!(Number.isInteger(d.b) && d.b >= 10 && d.b <= 60)) bad.push(`day ${i + 1}: ball ${d.b}`);
      if (!(Number.isInteger(d.to) && d.to >= 0 && d.to <= 3)) bad.push(`day ${i + 1}: ${d.to} timeouts`);
      if (!Number.isInteger(d.s) || d.s <= 0) bad.push(`day ${i + 1}: seed`);
    });
    const one = dr.dateOf(1), [y, m, dd] = D.start.split('-').map(Number);
    const startOk = one.getFullYear() === y && one.getMonth() === m - 1 && one.getDate() === dd && dr.todayNumber(new Date(y, m - 1, dd, 23, 59)) === 1 && dr.todayNumber(new Date(y, m - 1, dd + 1, 0, 1)) === 2;
    if (!startOk) bad.push('day numbering');
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 8).join('; ') : `${D.days.length} days from ${D.start}`};
  });

  // 3. The rules, on many random drives
  check('Drill: random drives always end (win, tie or loss, matching the score), the clock only runs down, timeouts never go below zero, the down never passes 4, and the ball stays on the field', () => {
    need();
    const bad = [];
    let n = 0;
    const res = {W: 0, T: 0, L: 0};
    for (let d = 1; d <= 30; d++) {
      for (let k = 0; k < 8; k++) {
        const {s, trail} = randomDrive(dr.scenario(d), d * 100 + k);
        n++;
        if (!s.result) { bad.push(`day ${d}/${k}: never ended`); continue; }
        res[s.result]++;
        const want = s.us > s.them ? 'W' : s.us === s.them ? 'T' : 'L';
        if (want !== s.result) bad.push(`day ${d}/${k}: ${s.result} at ${s.us}-${s.them}`);
        trail.forEach(({before, after}) => {
          if (after.clock > before.clock || after.clock < 0) bad.push(`day ${d}/${k}: clock ${before.clock} -> ${after.clock}`);
          if (after.tos < 0 || after.tos > before.tos) bad.push(`day ${d}/${k}: timeouts`);
          if (after.down > 4 && !s.result) bad.push(`day ${d}/${k}: down ${after.down}`);
          if (after.ball < 0 || after.ball > 100) bad.push(`day ${d}/${k}: ball ${after.ball}`);
        });
      }
    }
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `${n} drives: ${res.W} won, ${res.T} tied, ${res.L} lost`};
  });

  // 4. Determinism
  check('Drill: a drive replays exactly from its action string (what phones store and post), a refused action stops the replay, and the same call in the same spot always gets the same result', () => {
    need();
    const bad = [];
    for (let d = 1; d <= 20; d++) {
      const {s} = randomDrive(dr.scenario(d), d);
      const r = E.replay(dr.scenario(d), dr.DOC.teams, E.actsOf(s));
      const sig = x => [x.result, x.us, x.them, x.clock, x.ball, x.plays.length, x.plays.map(p => p.kind + (p.gain || 0)).join()].join('|');
      if (sig(r) !== sig(s)) bad.push(`day ${d}`);
    }
    // 'p' (the extra point) isn't allowed before a touchdown: the replay stops there.
    const cut = E.replay(dr.scenario(1), dr.DOC.teams, 'sps');
    if (cut.plays.length !== 1) bad.push(`replay past a refused action: ${cut.plays.length} plays`);
    const a = E.replay(dr.scenario(3), dr.DOC.teams, 'ld'), b = E.replay(dr.scenario(3), dr.DOC.teams, 'ld');
    if (a.plays[1].kind !== b.plays[1].kind || a.plays[1].gain !== b.plays[1].gain || a.look !== b.look) bad.push('same calls, different results');
    return {pass: !bad.length, detail: bad.length ? bad.join('; ') : '20 drives replayed exactly'};
  });

  // 5. The clock rules
  check('Drill: an incompletion and a timeout stop the clock, a catch in bounds keeps it running (the next snap takes 15 seconds), a spike costs a down, and a snap the clock runs out on loses', () => {
    need();
    const T = dr.DOC.teams, base = {o: 'KC', d: 'LV', us: 20, them: 24, t: 100, b: 40, to: 1, s: 7};
    const bad = [];
    // Find, among seeds, an incompletion and an in-bounds gain.
    let inc = null, run = null;
    for (let seed = 1; seed < 400 && !(inc && run); seed++) {
      const s = E.start(Object.assign({}, base, {s: seed}), T);
      const p = E.act(s, 'd');
      if (!inc && p.kind === 'inc') inc = {s, p};
      const s2 = E.start(Object.assign({}, base, {s: seed}), T);
      const q = E.act(s2, 'r');
      if (!run && q.kind === 'run' && !q.oob && !s2.result && q.gain > 0) run = {s: s2, p: q};
    }
    if (!inc || inc.s.running || inc.s.down !== 2) bad.push('incompletion');
    if (!run || !run.s.running) bad.push('run in bounds');
    if (run) {
      const c0 = run.s.clock;
      const tOk = E.act(run.s, 't');
      if (!tOk || run.s.running || run.s.tos !== 0 || run.s.clock !== c0) bad.push('timeout');
      if (E.options(run.s).timeout) bad.push('a timeout with none left');
    }
    // A spike from a running clock: a down gone, the clock stopped, about 7 seconds off.
    if (run) {
      const s = E.replay(Object.assign({}, base, {s: run.s.sc.s}), T, 'r');
      const c0 = s.clock, d0 = s.down;
      E.act(s, 'k');
      if (s.running || s.down !== d0 + 1 || c0 - s.clock !== E.SPIKE_SET + 1) bad.push(`spike: ${c0} -> ${s.clock}, down ${d0} -> ${s.down}`);
    }
    // A running clock with 10 seconds left and no timeouts: a play can't be snapped in time.
    const s = E.start(Object.assign({}, base, {t: 10, to: 0}), T);
    s.running = true;
    const p = E.act(s, 's');
    if (!p || p.kind !== 'expired' || s.result !== 'L' || s.why !== 'clock') bad.push('the clock running out before the snap');
    return {pass: !bad.length, detail: bad.length ? bad.join('; ') : 'stops, runs, timeout, spike and expiry as the rules say'};
  });

  // 6. Scoring
  check('Drill: down 7, a touchdown brings the choice (the kick ties it, two points win it); a field goal is offered only down 3 or less, in range', () => {
    need();
    const T = dr.DOC.teams, bad = [];
    const sc = {o: 'BUF', d: 'MIA', us: 17, them: 24, t: 60, b: 99, to: 2, s: 11};
    let td = null;
    for (let seed = 1; seed < 300 && !td; seed++) {
      const s = E.start(Object.assign({}, sc, {s: seed}), T);
      const p = E.act(s, 'r');
      if (p && p.td) td = s;
    }
    if (!td || td.phase !== 'pat' || td.us !== 23 || td.result) bad.push('touchdown down 7');
    if (td) {
      const o = E.options(td);
      if (!o.pat || o.fg || o.timeout || o.plays.join() !== E.TWO_PT.join()) bad.push('the choice');
      const k = E.replay(Object.assign({}, sc, {s: td.sc.s}), T, 'rp');
      if (k.result !== 'T' || k.us !== 24) bad.push(`kick: ${k.result} ${k.us}`);
      const two = E.replay(Object.assign({}, sc, {s: td.sc.s}), T, 'rR');
      if (!two.result || (two.result === 'W') !== (two.us === 25)) bad.push('two-point try');
    }
    const fgDown4 = E.options(E.start({o: 'BUF', d: 'MIA', us: 20, them: 24, t: 60, b: 75, to: 2, s: 1}, T)).fg;
    const fgDown3 = E.options(E.start({o: 'BUF', d: 'MIA', us: 21, them: 24, t: 60, b: 75, to: 2, s: 1}, T)).fg;
    const far = E.options(E.start({o: 'BUF', d: 'MIA', us: 21, them: 24, t: 60, b: 25, to: 2, s: 1}, T)).fg;
    if (fgDown4 || !fgDown3 || fgDown3.dist !== 42 || !(fgDown3.p > 0.75 && fgDown3.p < 0.95) || far) bad.push('field goal offers');
    return {pass: !bad.length, detail: bad.length ? bad.join('; ') : `kick ties, two wins; a 42-yarder at ${Math.round(fgDown3.p * 100)}%`};
  });

  // 7. Survivor
  check('Drill: Survivor drives are valid spots that get harder (less time, fewer timeouts) as a run goes on', () => {
    need();
    const ids = Object.keys(dr.DOC.teams).sort(), bad = [];
    let early = 0, late = 0, earlyTo = 0, lateTo = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (let i = 0; i <= 14; i++) {
        const sc = E.survivorScenario(seed, i, ids);
        const deficit = sc.them - sc.us;
        if (!dr.DOC.teams[sc.o] || !dr.DOC.teams[sc.d] || sc.o === sc.d || deficit < 1 || deficit > 7 || sc.t < 30 || sc.b < 10 || sc.to < 0 || sc.to > 3) bad.push(`${seed}/${i}`);
        if (i <= 1) { early += sc.t; earlyTo += sc.to; }
        if (i >= 12) { late += sc.t; lateTo += sc.to; }
      }
    }
    if (!(early / 80 > late / 120 + 30) || !(earlyTo / 80 > lateTo / 120)) bad.push(`ramp: ${Math.round(early / 80)}s -> ${Math.round(late / 120)}s`);
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `early drives ${Math.round(early / 80)}s with ${(earlyTo / 80).toFixed(1)} timeouts, late ${Math.round(late / 120)}s with ${(lateTo / 120).toFixed(1)}`};
  });

  // 8. Words and sharing
  check('Drill: every play has words, the spot reads like a broadcast (DEN 35, midfield, SEA 12), and the share text has the result and a square per snap but no player names', () => {
    need();
    const bad = [];
    for (let d = 1; d <= 15; d++) {
      const {s} = randomDrive(dr.scenario(d), 900 + d);
      s.plays.forEach(p => { const t = dr.playText(s, p); if (!t || !t.head || /undefined|NaN/.test(t.head + t.sub)) bad.push(`day ${d} ${p.kind}`); });
      const txt = dr.shareText(d, s);
      const names = dr.DOC.teams[s.sc.o].o.concat(dr.DOC.teams[s.sc.d].d).map(p => p[1].split(' ').pop()).filter(x => x.length > 3);
      if (!txt.includes(`#${d}`) || !txt.includes(`${s.us}–${s.them}`) || names.some(nm => txt.includes(nm))) bad.push(`share ${d}`);
    }
    const s = E.start(dr.scenario(1), dr.DOC.teams);
    const spots = [dr.spot(s, 35), dr.spot(s, 50), dr.spot(s, 88)].join(', ');
    if (spots !== `${s.sc.o} 35, midfield, ${s.sc.d} 12`) bad.push(spots);
    if (dr.downText(1, 10, 40) !== '1st & 10' || dr.downText(3, 7, 93) !== '3rd & goal' || dr.clockText(65) !== '1:05') bad.push('down/clock text');
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `words for 15 drives; ${spots}`};
  });

  // 9. The scoreboard
  check('Drill: the scoreboard keeps one drive per member per day (the first posted), drops bad entries, ranks wins (more time left first), then ties, then losses (furthest first), and Survivor by best run', () => {
    need();
    const docs = [
      {id: 'a', nick: 'Ben', d2m: {1: {r: 'L', c: 0, p: 9, y: 88, k: '', t: 10}}, d2s: {b: 4, t: 1}},
      {id: 'b', nick: 'Mitch', d2m: {1: {r: 'W', c: 12, p: 8, y: 100, k: '', t: 20}}, d2s: {b: 2, t: 1}},
      {id: 'c', nick: 'Mitch', d2m: {1: {r: 'L', c: 0, p: 3, y: 30, t: 5}}, d2s: {b: 7, t: 1}}, // his other phone, earlier: this one counts
      {id: 'd', nick: 'Jacob', d2m: {1: {r: 'W', c: 40, p: 6, y: 100, t: 15}}},
      {id: 'e', nick: 'Nobody Special', d2m: {1: {r: 'X'}, 2: {c: 3}}},
      {id: 'f', nick: 'Sayer', d2m: {1: {r: 'T', c: 2, p: 12, y: 75, t: 9}}}
    ];
    const sig = rows => rows.map(r => `${r.rank}.${r.name} ${r.r}`).join(', ');
    const t1 = dr.boardRows('today', 1, docs);
    const sv = dr.boardRows('survivor', 1, docs).map(r => `${r.rank}.${r.name} ${r.b}`).join(', ');
    const today = sig(t1) === '1.Jacob W, 2.Sayer T, 3.Ben L, 4.Mitch L' && t1.find(r => r.name === 'Mitch').y === 30;
    const clean = dr.entryOf(docs[4], 1) === null && dr.entryOf(docs[4], 2) === null && dr.entryOf(docs[0], 1).r === 'L';
    const surv = sv === '1.Mitch 7, 2.Ben 4';
    return {pass: today && clean && surv, detail: `today: ${sig(t1)}; survivor: ${sv}; bad entries dropped ${clean}`};
  });
}
