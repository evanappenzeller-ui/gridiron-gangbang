// Two-Minute Drill checks for the dev gallery (#/_kit): data/drill.json (the teams' starters and ratings, the days'
// situations), the engine's rules (js/core/drill-sim.js: the clock, the chains, the score, the other team's ball and
// your defense, determinism, the action tokens, the pass menu's odds, the bots and win chances), the words, and the
// league scoreboard's rows (on crafted board docs). checks.js (owner: core) imports
// drillChecks and calls it with its own check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here
// writes to storage or the database; the only read is the repo's own data/drill.json. Owner: Drill.

import * as dr from './drill.js';

const E = dr.E;
const OFF = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'];
const DEF = {
  '43': ['LDE', 'LDT', 'RDT', 'RDE', 'WLB', 'MLB', 'SLB', 'LCB', 'RCB', 'SS', 'FS', 'NB'],
  '34': ['LDE', 'NT', 'RDE', 'WLB', 'LILB', 'RILB', 'SLB', 'LCB', 'RCB', 'SS', 'FS', 'NB']
};
const TOOLS = [E.tok.spike, E.tok.timeout, E.tok.fg, E.tok.kick, E.tok.trick, E.tok.kneel, E.tok.def('c2'), 'zz', 'p9go', 'rq', 'dzz'];
const DEFS = E.DEF_CALLS.map(E.tok.def);

/** A game played to the end with seeded random actions (any play or defense, and the tools whether allowed or not, like
 *  a careless thumb). */
function randomGame(sc, seed) {
  const s = E.start(sc, dr.DOC.teams);
  const r = E.dice(seed, 4242);
  const trail = [];
  for (let i = 0; i < 400 && !s.result; i++) {
    const before = {clock: s.clock, tos: s.tos, dtos: s.dtos, us: s.us, them: s.them};
    const pool = r() < 0.25 ? TOOLS : s.poss === 'them' && s.phase !== 'pat' ? DEFS : E.candidates(s, true).map(c => c.token);
    const p = E.act(s, pool[Math.floor(r() * pool.length)]);
    if (p) trail.push({before, p, after: {clock: s.clock, tos: s.tos, dtos: s.dtos, down: s.down, ball: s.ball, us: s.us, them: s.them}});
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
  check('Drill: every day is two different teams and a comeback spot (down 1-7 with 2:00 left, the ball between your 10 and their 40, 0-3 timeouts) that starts with your ball, the clock stopped, 1st & 10; day 1 on the start date', () => {
    need();
    const D = dr.DOC, bad = [];
    D.days.forEach((d, i) => {
      const deficit = d.them - d.us;
      if (!D.teams[d.o] || !D.teams[d.d] || d.o === d.d) bad.push(`day ${i + 1}: teams`);
      if (!(Number.isInteger(d.us) && deficit >= 1 && deficit <= 7 && d.us >= 0)) bad.push(`day ${i + 1}: score ${d.us}-${d.them}`);
      if (d.t !== 120) bad.push(`day ${i + 1}: ${d.t}s`);
      if (!(Number.isInteger(d.b) && d.b >= 10 && d.b <= 60)) bad.push(`day ${i + 1}: ball ${d.b}`);
      if (!(Number.isInteger(d.to) && d.to >= 0 && d.to <= 3)) bad.push(`day ${i + 1}: ${d.to} timeouts`);
      if (!Number.isInteger(d.s) || d.s <= 0) bad.push(`day ${i + 1}: seed`);
      const s = E.start(dr.scenario(i + 1), D.teams), o = E.options(s);
      if (s.poss !== 'us' || s.clock !== 120 || s.running || s.down !== 1 || s.phase !== 'play' || s.result || !o.plays.length || o.def.length) bad.push(`day ${i + 1}: the start`);
    });
    const one = dr.dateOf(1), [y, m, dd] = D.start.split('-').map(Number);
    const startOk = one.getFullYear() === y && one.getMonth() === m - 1 && one.getDate() === dd && dr.todayNumber(new Date(y, m - 1, dd, 23, 59)) === 1 && dr.todayNumber(new Date(y, m - 1, dd + 1, 0, 1)) === 2;
    if (!startOk) bad.push('day numbering');
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 8).join('; ') : `${D.days.length} days from ${D.start}`};
  });

  // 3. The rules, on many random drives
  check('Drill: random games always end (win, tie or loss, matching the score), the clock only runs down, timeouts never go below zero, the down never passes 4, the ball stays on the field, and scores only go up', () => {
    need();
    const bad = [];
    let n = 0, def = 0;
    const res = {W: 0, T: 0, L: 0};
    for (let d = 1; d <= 30; d++) {
      for (let k = 0; k < 8; k++) {
        const {s, trail} = randomGame(dr.scenario(d), d * 100 + k);
        n++;
        if (!s.result) { bad.push(`day ${d}/${k}: never ended`); continue; }
        res[s.result]++;
        if (s.plays.some(p => p.poss === 'them')) def++;
        const want = s.us > s.them ? 'W' : s.us === s.them ? 'T' : 'L';
        if (want !== s.result) bad.push(`day ${d}/${k}: ${s.result} at ${s.us}-${s.them}`);
        trail.forEach(({before, after}) => {
          if (after.clock > before.clock || after.clock < 0) bad.push(`day ${d}/${k}: clock ${before.clock} -> ${after.clock}`);
          if (after.tos < 0 || after.tos > before.tos || after.dtos < 0 || after.dtos > before.dtos) bad.push(`day ${d}/${k}: timeouts`);
          if (after.us < before.us || after.them < before.them) bad.push(`day ${d}/${k}: a score went down`);
          if (after.down > 4 && !s.result) bad.push(`day ${d}/${k}: down ${after.down}`);
          if (after.ball < 0 || after.ball > 100) bad.push(`day ${d}/${k}: ball ${after.ball}`);
        });
      }
    }
    if (!def) bad.push('no game ever reached your defense');
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `${n} games: ${res.W} won, ${res.T} tied, ${res.L} lost; ${def} with you on defense`};
  });

  // 4. Determinism
  check('Drill: a game replays exactly from its action string (what phones store and post), a refused action stops the replay, the same call in the same spot always gets the same result, and every token reads back as written', () => {
    need();
    const bad = [];
    for (let d = 1; d <= 20; d++) {
      const {s} = randomGame(dr.scenario(d), d);
      const r = E.replay(dr.scenario(d), dr.DOC.teams, E.actsOf(s));
      const sig = x => [x.result, x.us, x.them, x.clock, x.ball, x.poss, x.plays.length, x.plays.map(p => p.kind + (p.gain || 0) + p.dcall + (p.tact || '')).join()].join('|');
      if (sig(r) !== sig(s)) bad.push(`day ${d}`);
    }
    // The extra point isn't allowed before a touchdown: the replay stops there.
    const cut = E.replay(dr.scenario(1), dr.DOC.teams, 'rs,e,rs');
    if (cut.plays.length !== 1) bad.push(`replay past a refused action: ${cut.plays.length} plays`);
    const a = E.replay(dr.scenario(3), dr.DOC.teams, 'p0go,rw+o'), b = E.replay(dr.scenario(3), dr.DOC.teams, 'p0go,rw+o');
    if (a.plays.length !== 2 || a.plays[1].kind !== b.plays[1].kind || a.plays[1].gain !== b.plays[1].gain || a.look !== b.look) bad.push('same calls, different results');
    const toks = [E.tok.pass('WR2', 'dig', {a: true, o: true, c: 2}), E.tok.pass('RB', 'wheel'), E.tok.run('w', true, 't'), E.tok.rpo('s', false, 'b'), E.tok.def('fire'), 'x', 'k', 't', 'f', 'e', 'n', E.tok.tricks('r'), E.tok.run('s')];
    const back = toks.map(t => E.parse(t));
    if (back.some(x => !x) || back[0].slot !== 'WR2' || back[0].route !== 'dig' || !back[0].flags.a || !back[0].flags.o || back[0].flags.r || back[0].card !== 2 || back[1].card !== 0
      || back[2].dir !== 'w' || !back[2].flags.o || back[2].play !== 't' || back[3].play !== 'b' || back[4].call !== 'fire' || back[5].play !== 'f' || back[10].kind !== 'kneel' || back[11].play !== 'r' || back[12].play !== 'z' || toks[12] !== 'rs') bad.push('tokens');
    if (['p4go', 'p9dig', 'rx', 'x+q', 'dzz', 'dc2+o', 'rsz', 'oss', 'xf', 'xq', 'rsq', 'p0go+3', 'rs+1', 'xh+o'].some(t => E.parse(t))) bad.push('bad tokens accepted');
    return {pass: !bad.length, detail: bad.length ? bad.join('; ') : '20 games replayed exactly; tokens read back'};
  });

  // 5. The clock rules
  check('Drill: an incompletion and a timeout stop the clock, a catch in bounds keeps it running (the next snap takes 15 seconds, 7 with no huddle), a spike costs a down, and a snap the clock runs out on loses', () => {
    need();
    const T = dr.DOC.teams, base = {o: 'KC', d: 'LV', us: 20, them: 24, t: 100, b: 40, to: 1, s: 7};
    const bad = [];
    // Find, among seeds, an incompletion and an in-bounds gain.
    let inc = null, run = null;
    for (let seed = 1; seed < 400 && !(inc && run); seed++) {
      const s = E.start(Object.assign({}, base, {s: seed}), T);
      const p = E.act(s, 'p0go');
      if (!inc && p.kind === 'inc') inc = {s, p};
      const s2 = E.start(Object.assign({}, base, {s: seed}), T);
      const q = E.act(s2, 'rs');
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
      const s = E.replay(Object.assign({}, base, {s: run.s.sc.s}), T, 'rs');
      const c0 = s.clock, d0 = s.down;
      E.act(s, 'k');
      if (s.running || s.down !== d0 + 1 || c0 - s.clock !== E.SPIKE_SET + 1) bad.push(`spike: ${c0} -> ${s.clock}, down ${d0} -> ${s.down}`);
    }
    // No huddle: the same snap from a running clock comes HURRY - NO_HUDDLE seconds sooner; a trick play can't go without a huddle.
    if (run) {
      const a = E.replay(Object.assign({}, base, {s: run.s.sc.s}), T, 'rs'), b = E.replay(Object.assign({}, base, {s: run.s.sc.s}), T, 'rs');
      const pa = E.act(a, 'p0go'), pb = E.act(b, E.tok.pass('WR1', 'go', {h: true}));
      if (!pa || !pb || pb.clock - pa.clock !== E.HURRY - E.NO_HUDDLE) bad.push(`no huddle: snapped at ${pb && pb.clock} vs ${pa && pa.clock}`);
    }
    if (E.parse('x+h') || E.parse('k+h') || E.parse('dc2+h') || !E.parse(E.tok.run('w', true, 'd', true)).flags.h) bad.push('no-huddle tokens');
    // A running clock with 10 seconds left and no timeouts: a play can't be snapped in time.
    const s = E.start(Object.assign({}, base, {t: 10, to: 0}), T);
    s.running = true;
    const p = E.act(s, 'p2slant');
    if (!p || p.kind !== 'expired' || s.result !== 'L' || s.why !== 'clock') bad.push('the clock running out before the snap');
    return {pass: !bad.length, detail: bad.length ? bad.join('; ') : 'stops, runs, timeout, spike and expiry as the rules say'};
  });

  // 6. Scoring
  check('Drill: down 7, a touchdown brings the choice (kick to tie, or go for two), then they get the ball at their 25; a touchdown on the last snap still gets its try; a field goal is offered only down 3 or less, in range', () => {
    need();
    const T = dr.DOC.teams, bad = [];
    const sc = {o: 'BUF', d: 'MIA', us: 17, them: 24, t: 60, b: 99, to: 2, s: 11};
    let td = null;
    for (let seed = 1; seed < 300 && !td; seed++) {
      const s = E.start(Object.assign({}, sc, {s: seed}), T);
      const p = E.act(s, 'rw');
      if (p && p.td) td = s;
    }
    if (!td || td.phase !== 'pat' || td.us !== 23 || td.result) bad.push('touchdown down 7');
    if (td) {
      const o = E.options(td);
      if (!o.pat || o.fg || o.timeout || !['pass', 'run', 'rpo'].every(k => o.plays.includes(k))) bad.push('the choice');
      const k = E.replay(Object.assign({}, sc, {s: td.sc.s}), T, 'rw,e');
      if (k.result || k.us !== 24 || k.poss !== 'them' || k.ball !== 25 || k.phase !== 'play' || k.running) bad.push(`kick: ${k.result} ${k.us}, ${k.poss} ball on ${k.ball}`);
      const two = E.replay(Object.assign({}, sc, {s: td.sc.s}), T, 'rw,p3drag');
      if (![23, 25].includes(two.us) || two.poss !== 'them' || two.plays[1].kind !== (two.us === 25 ? '2good' : '2fail')) bad.push('two-point try');
    }
    // No time left: the try still happens, and then it's over.
    let last = null;
    for (let seed = 1; seed < 300 && !last; seed++) {
      const s = E.start(Object.assign({}, sc, {t: 3, s: seed}), T);
      const p = E.act(s, 'rw');
      if (p && p.td) last = s;
    }
    if (!last || last.clock !== 0 || last.phase !== 'pat' || last.result) bad.push('a touchdown as time runs out');
    else {
      E.act(last, 'e');
      if (last.result !== 'T' || last.us !== 24) bad.push(`the kick at 0:00: ${last.result}`);
    }
    const fgDown4 = E.options(E.start({o: 'BUF', d: 'MIA', us: 20, them: 24, t: 60, b: 75, to: 2, s: 1}, T)).fg;
    const fgDown3 = E.options(E.start({o: 'BUF', d: 'MIA', us: 21, them: 24, t: 60, b: 75, to: 2, s: 1}, T)).fg;
    const far = E.options(E.start({o: 'BUF', d: 'MIA', us: 21, them: 24, t: 60, b: 25, to: 2, s: 1}, T)).fg;
    if (fgDown4 || !fgDown3 || fgDown3.dist !== 42 || !(fgDown3.p > 0.75 && fgDown3.p < 0.95) || far) bad.push('field goal offers');
    return {pass: !bad.length, detail: bad.length ? bad.join('; ') : `kick ties, two wins; a 42-yarder at ${Math.round(fgDown3.p * 100)}%`};
  });

  // 6b. The pass menu's odds and the win chances
  check('Drill: the pass menu\'s odds are sane (caught, yards a throw, picked), the bots finish games, and win chances and option scores (on offense and on defense) land between 0 and 1, best first', () => {
    need();
    const bad = [];
    const s = E.start(dr.scenario(2), dr.DOC.teams);
    E.TARGETS.forEach(slot => E.ROUTES_FOR[slot].forEach(route => {
      const o = E.odds(s, slot, route);
      if (!(o.caught > 0.05 && o.caught < 0.95 && o.picked >= 0 && o.picked < 0.2 && o.ypt > -3 && o.ypt < 25)) bad.push(`${slot} ${route}`);
    }));
    const deep = E.odds(s, 'WR1', 'go'), quick = E.odds(s, 'WR1', 'slant');
    if (!(deep.caught < quick.caught && deep.picked > quick.picked)) bad.push('a go route should be caught less and picked more than a slant');
    const f = E.finish(E.start(dr.scenario(4), dr.DOC.teams), E.dice(1, 2), 0.8, true);
    if (!f.result) bad.push('bot game never ended');
    const wp = E.winChance(s, 20), sc = E.scoreOptions(s, null, 6);
    if (!(wp >= 0 && wp <= 1)) bad.push(`win chance ${wp}`);
    const sorted = list => list.length && !list.some((x, i) => x.wp < 0 || x.wp > 1 || (i && x.wp > list[i - 1].wp));
    if (!sorted(sc)) bad.push('option scores');
    // On defense: every call scored.
    let dsc = [];
    for (let d = 1; d <= 40 && !dsc.length; d++) {
      const g = E.finish(E.start(dr.scenario(d), dr.DOC.teams), E.dice(d, 3), 0.8, true);
      const i = g.plays.findIndex(p => p.poss === 'them' && p.act);
      if (i < 0) continue;
      const at = E.replay(g.sc, dr.DOC.teams, g.plays.slice(0, i).filter(p => p.act).map(p => p.act).join(','));
      if (at.poss === 'them') dsc = E.scoreOptions(at, null, 4);
    }
    if (dsc.length !== E.DEF_CALLS.length || !sorted(dsc) || dsc.some(x => E.parse(x.token).kind !== 'def')) bad.push(`defense scores: ${dsc.length}`);
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `win chance ${Math.round(wp * 100)}% at the start of day 2; ${sc.length} options scored on offense, ${dsc.length} on defense`};
  });

  // 6c. The playbook
  check('Drill: every play type offers three plays (three pass plays a snap from the playbook, every route one the receiver runs; three runs, RPOs and trick plays), each one callable, and a pass names its play', () => {
    need();
    const bad = [];
    if ([E.RUNS, E.RPOS, E.TRICKS].some(b => Object.keys(b).length !== 3)) bad.push('three of each');
    Object.entries(E.PASS_PLAYS).forEach(([k, P]) => { if (!P.name || E.TARGETS.some(slot => !E.ROUTES_FOR[slot].includes(P.routes[slot]))) bad.push(`play ${k}`); });
    let snaps = 0, hail = 0;
    for (let d = 1; d <= 20; d++) {
      const g = E.start(dr.scenario(d), dr.DOC.teams);
      for (let i = 0; i < 6 && !g.result && g.poss === 'us'; i++) {
        snaps++;
        if (!Array.isArray(g.book) || g.book.length !== 3 || new Set(g.book).size !== 3 || g.book.some(k => !E.PASS_PLAYS[k])) { bad.push(`day ${d}: the book`); break; }
        if (g.book.includes('hail')) hail++;
        const want = g.book[2], routes = E.PASS_PLAYS[want].routes;
        if (JSON.stringify(g.routes) !== JSON.stringify(E.PASS_PLAYS[g.book[0]].routes)) bad.push(`day ${d}: routes drawn up`);
        const plays = ['run', 'rpo'].flatMap(k => Object.keys(k === 'run' ? E.RUNS : E.RPOS).map(x => E.tok[k]('w', false, x))).concat(Object.keys(E.TRICKS).map(E.tok.tricks));
        plays.forEach(t => { const f = E.replay(g.sc, dr.DOC.teams, E.actsOf(g)); if (!E.act(f, t)) bad.push(`day ${d}: ${t} refused`); });
        const p = E.act(g, E.tok.pass('WR1', routes.WR1, {c: 2}));
        if (!p || p.pp !== want || p.routes.TE !== routes.TE) { bad.push(`day ${d}: the pass play`); break; }
      }
    }
    const late = E.start(Object.assign({}, dr.scenario(1), {t: 8, b: 40}), dr.DOC.teams);
    if (!late.book.includes('hail')) bad.push('no Hail Mary with 0:08 left from your 40');
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `${Object.keys(E.PASS_PLAYS).length} pass plays; ${snaps} snaps each offered three; every run, RPO and trick callable`};
  });

  // 6d. The coach comp
  check('Drill: the coach comp: every NFL head coach\'s late-game tendencies as sane counts, a comp with words for finished games, and calls that lean one way match a coach who leans that way too', () => {
    need();
    const C = dr.DOC.coaches, bad = [];
    if (!C || !Array.isArray(C.list) || C.list.length < 30) return {pass: false, detail: 'no coaches in drill.json'};
    const F = ['pass', 'deep', 'short', 'middle', 'oob', 'spike', 'two', 'fourth'];
    C.list.forEach(c => {
      if (!c.n || !dr.DOC.teams[c.t] || !(c.s >= 30)) bad.push(`${c.n}: name/team/snaps`);
      F.forEach(f => { const [k, n] = c.f[f] || []; if (!(Number.isInteger(k) && Number.isInteger(n) && k >= 0 && k <= n)) bad.push(`${c.n} ${f}`); });
    });
    F.forEach(f => { if (!(C.league[f] > 0 && C.league[f] < 1)) bad.push(`league ${f}`); });
    let comps = 0;
    for (let d = 1; d <= 15; d++) {
      const {s} = randomGame(dr.scenario(d), 700 + d);
      const c = dr.coachComp(s), t = dr.tendencies(s);
      if (t.spike[1] >= 3 && !c) bad.push(`day ${d}: no comp`);
      if (c) { comps++; if (!c.name || /undefined|NaN/.test(c.text + c.teamName)) bad.push(`day ${d}: words`); }
    }
    const z = () => ({pass: [0, 0], deep: [0, 0], short: [0, 0], middle: [0, 0], oob: [0, 0], spike: [0, 0], two: [0, 0], fourth: [0, 0]});
    const deep = Object.assign(z(), {pass: [10, 10], deep: [7, 10], short: [1, 10], spike: [0, 10]});
    const short = Object.assign(z(), {pass: [10, 10], deep: [0, 10], short: [10, 10], spike: [0, 10]});
    const md = dr.matchCoach(deep), ms = dr.matchCoach(short);
    const r = (c, f) => c.f[f][0] / c.f[f][1];
    if (!md || r(md.coach, 'deep') <= C.league.deep || !/deep shot/.test(md.lines.join())) bad.push(`deep thrower matched ${md && md.coach.n}`);
    if (!ms || r(ms.coach, 'short') <= C.league.short || !/short|underneath/.test(ms.lines.join())) bad.push(`short thrower matched ${ms && ms.coach.n}`);
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `${C.list.length} coaches (${C.seasons}); ${comps} of 15 random games comped; deep thrower → ${md.coach.n}, short thrower → ${ms.coach.n}`};
  });

  // 7. Their ball: your defense, their clock, the kneel
  check('Drill: after your score with time left they get the ball at their 25 and you can only call a defense (or a timeout on their running clock); their play is set by the snap, not your call; a team ahead with the ball late kneels it out', () => {
    need();
    const T = dr.DOC.teams, bad = [];
    const sc = {o: 'BUF', d: 'MIA', us: 21, them: 24, t: 100, b: 75, to: 2, dto: 2};
    let s = null;
    for (let seed = 1; seed < 200 && !s; seed++) {
      const x = E.start(Object.assign({}, sc, {s: seed}), T);
      const p = E.act(x, 'f');
      if (p && p.kind === 'fg') s = x;
    }
    if (!s || s.poss !== 'them' || s.ball !== 25 || s.us !== 24 || s.result || s.phase !== 'play' || s.running || !E.FORMS[s.form]) bad.push('the kickoff after a field goal');
    else {
      const o = E.options(s);
      if (o.def.length !== E.DEF_CALLS.length || o.plays.length || o.fg || o.spike || o.kneel || o.timeout) bad.push('defense options');
      if (E.act(s, 'rs') || E.act(s, 'p0go') || E.act(s, 'f') || E.act(s, 'n')) bad.push('an offensive call on defense');
      const acts = E.actsOf(s);
      const a = E.replay(s.sc, T, acts + ',dc2'), b = E.replay(s.sc, T, acts + ',dc0');
      const pa = a.plays[1], pb = b.plays[1];
      if (!pa || pa.poss !== 'them' || pa.dcall !== 'c2' || !pa.their || !pb || pa.tact !== pb.tact) bad.push('their play, whatever your call');
    }
    // You lead with the ball and little time: a kneel ends it.
    const k = E.start({o: 'BUF', d: 'MIA', us: 28, them: 24, t: 30, b: 50, to: 0, dto: 0, s: 3}, T);
    if (!E.options(k).kneel) bad.push('no kneel when you lead');
    E.act(k, 'n');
    if (k.result !== 'W' || k.why !== 'kneel') bad.push(`your kneel: ${k.result} ${k.why}`);
    // They pick it off while ahead with time short: they kneel it out.
    let them = null;
    for (let seed = 1; seed < 600 && !them; seed++) {
      const x = E.start({o: 'BUF', d: 'MIA', us: 20, them: 24, t: 40, b: 30, to: 0, dto: 2, s: seed}, T);
      const p = E.act(x, 'p0go');
      if (p && p.kind === 'int') them = x;
    }
    if (!them || them.result !== 'L' || them.why !== 'their-kneel' || them.plays[them.plays.length - 1].kind !== 'kneelout') bad.push('their kneel');
    return {pass: !bad.length, detail: bad.length ? bad.join('; ') : 'kickoff to their 25, eight calls, their play fixed at the snap, kneels both ways'};
  });

  // 8. Words and sharing
  check('Drill: every play has words (yours and theirs), the spot reads like a broadcast from the side with the ball (DEN 35, midfield, SEA 12), and the share text has the final score and a square per snap but no player names', () => {
    need();
    const bad = [];
    for (let d = 1; d <= 15; d++) {
      const {s} = randomGame(dr.scenario(d), 900 + d);
      s.plays.forEach(p => {
        const t = dr.playText(s, p), c = dr.callText(s, p);
        if (!t || !t.line || /undefined|NaN/.test(t.head + t.line + (c ? c.text : '') + dr.tokenLabel(s, p.act) + dr.tokenShort(s, p.act))) bad.push(`day ${d} ${p.kind}`);
      });
      const txt = dr.shareText(d, s);
      const both = [dr.DOC.teams[s.sc.o], dr.DOC.teams[s.sc.d]];
      const names = both.flatMap(t => t.o.concat(t.d)).map(p => p[1].split(' ').pop()).filter(x => x.length > 3);
      if (!txt.includes(`#${d}`) || !txt.includes(`${s.sc.o} ${s.us}, ${s.sc.d} ${s.them} (${s.result})`) || names.some(nm => txt.includes(nm))) bad.push(`share ${d}`);
    }
    const s = E.start(dr.scenario(1), dr.DOC.teams);
    const spots = [dr.spot(s, 35), dr.spot(s, 50), dr.spot(s, 88)].join(', ');
    if (spots !== `${s.sc.o} 35, midfield, ${s.sc.d} 12`) bad.push(spots);
    if (dr.spot(s, 35, 'them') !== `${s.sc.d} 35`) bad.push('their side');
    if (dr.downText(1, 10, 40) !== '1st & 10' || dr.downText(3, 7, 93) !== '3rd & goal' || dr.clockText(65) !== '1:05') bad.push('down/clock text');
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `words for 15 drives; ${spots}`};
  });

  // 9. The scoreboard
  check('Drill: the scoreboard keeps one game per member per day (the first posted), drops bad entries (a result that doesn\'t match the score) and results finished before a league-wide reset of that day, and ranks wins (the biggest margin first, then fewer plays), then ties, then losses (the closest first), tied rows sharing a rank', () => {
    need();
    const T0 = Date.now();
    const g = (r, u, h, p, t) => ({r, u, h, p, k: '', t: T0 + t});
    const docs = [
      {id: 'a', nick: 'Ben', dr5: {1: g('L', 21, 24, 9, 10)}},
      {id: 'b', nick: 'Mitch', dr5: {1: g('W', 27, 24, 8, 20)}},
      {id: 'c', nick: 'Mitch', dr5: {1: g('L', 17, 24, 3, 5)}}, // his other phone, earlier: this one counts
      {id: 'd', nick: 'Jacob', dr5: {1: g('W', 31, 24, 6, 15)}},
      {id: 'e', nick: 'Nobody Special', dr5: {1: g('W', 10, 20, 4, 1), 2: {u: 3}}},
      {id: 'f', nick: 'Sayer', dr5: {1: g('T', 24, 24, 12, 9)}},
      {id: 'g', nick: 'Kyle Example', dr5: {1: g('W', 28, 24, 10, 9)}},
      {id: 'h', nick: 'Evan Example', dr5: {1: g('W', 28, 24, 7, 9)}},
      {id: 'i', nick: 'Zed Example', dr5: {1: g('W', 28, 24, 7, 12)}}
    ];
    const t1 = dr.boardRows(1, docs);
    const sig = t1.map(r => `${r.rank}.${r.name.split(' ')[0]} ${r.r}`).join(', ');
    const order = sig === '1.Jacob W, 2.Evan W, 2.Zed W, 4.Kyle W, 5.Sayer T, 6.Ben L, 7.Mitch L' && t1.find(r => r.name === 'Mitch').u === 17;
    const clean = dr.entryOf(docs[4], 1) === null && dr.entryOf(docs[4], 2) === null && dr.entryOf(docs[0], 1).m === -3;
    // Day 1 was reset for everyone: a result finished before that is gone, one after it stays.
    const cut = dr.resetCut(1), old = {id: 'x', dr5: {1: {r: 'W', u: 28, h: 24, p: 6, k: '', t: cut - 1}}};
    const reset = cut > 0 && dr.entryOf(old, 1) === null && !!dr.entryOf({id: 'y', dr5: {1: Object.assign({}, old.dr5[1], {t: cut + 1})}}, 1) && dr.resetCut(2) === 0;
    return {pass: order && clean && reset, detail: `${sig}; bad entries dropped ${clean}; reset day 1 ${reset}`};
  });
}
