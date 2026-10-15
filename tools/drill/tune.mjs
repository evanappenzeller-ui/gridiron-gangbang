// Sets each Two-Minute Drill day's situation (the score, the clock, the ball, your timeouts) with the game's own engine.
// Run by tools/drill/build.py after it writes data/drill.json; on its own: node tools/drill/tune.mjs data/drill.json.
//
// For each day: the deficit from its seed (DEFICITS), then situations drawn from its seed until one where a good
// player (smart: reads the look, manages the clock) comes back TARGET of the time (wins or ties: down 3 a field goal
// ties it, down 7 a touchdown and the kick do), over SIMS drives with the day's two teams. A careless player (naive: random calls, sane clock) is reported too.
// Deterministic: the same file in, the same days out.
import fs from 'fs';
import * as E from '../../js/core/drill-sim.js';

const file = process.argv[2] || new URL('../../data/drill.json', import.meta.url).pathname;
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const T = doc.teams;
const SIMS = 500, TRIES = 30;
const TARGET = [0.45, 0.6];
const DEFICITS = [[2, 1], [3, 1.2], [4, 1.5], [5, 0.8], [6, 1.3], [7, 1.3]];

export function smart(s, r) {
  const o = E.options(s), A = E.ACT;
  if (s.phase === 'pat') {
    const best = {box: 'trick2', blitz: 'trick2', man: 'run2'}[s.look] || 'pass2';
    return r() < 0.5 ? A.kick : A[best];
  }
  if (o.fg && o.fg.p >= 0.5) {
    const late = s.down === 4 || s.clock <= 10 || (s.running && s.tos === 0 && s.clock <= E.HURRY + 6);
    if (late) {
      if (s.running && s.clock <= E.FG_SET + 1 && o.timeout) return A.timeout;
      if (!(s.running && s.clock <= E.FG_SET)) return A.fg;
    }
  }
  if (s.running) {
    if (s.clock <= E.HURRY + 1) { if (o.timeout) return A.timeout; if (o.spike) return A.spike; }
    if (s.clock <= 40 && o.timeout && 100 - s.ball > 20) return A.timeout;
  }
  const pref = {box: ['deep', 'short'], blitz: ['short', 'rpo'], two: ['run', 'rpo'], prevent: ['short', 'side'], man: ['deep', 'side']}[s.look];
  let call = pref[r() < 0.75 ? 0 : 1];
  if ((call === 'run' || call === 'rpo') && s.clock < 55 && s.tos === 0) call = 'short';
  if (s.clock < 40 && s.tos === 0 && s.look !== 'two') call = 'side';
  if (s.down >= 3 && s.togo <= 2 && s.look !== 'box') call = 'run';
  if (o.plays.includes('trick') && (s.look === 'box' || s.look === 'blitz') && r() < 0.25) call = 'trick';
  return A[call];
}
export function naive(s, r) {
  const o = E.options(s), A = E.ACT;
  if (s.phase === 'pat') return r() < 0.6 ? A.kick : A[E.TWO_PT[Math.floor(r() * 4)]];
  if (o.fg && o.fg.p >= 0.4 && (s.down === 4 || s.clock <= 12)) return s.running && o.timeout ? A.timeout : A.fg;
  if (s.running && s.clock <= 30 && o.timeout) return A.timeout;
  if (s.running && s.clock <= E.HURRY + 1 && o.spike) return A.spike;
  return A[o.plays[Math.floor(r() * o.plays.length)]];
}
export function drive(sc, bot, seed) {
  const s = E.start(sc, T);
  const r = E.dice(seed, 77);
  for (let guard = 0; !s.result && guard < 200; guard++) {
    if (!E.act(s, bot(s, r))) E.act(s, E.ACT.short) || E.act(s, E.ACT.kick);
  }
  return s;
}
function rate(sc, bot) {
  let pts = 0;
  for (let i = 0; i < SIMS; i++) {
    const s = drive(Object.assign({}, sc, {s: (sc.s + i * 7919) >>> 0}), bot, i);
    pts += s.result === 'L' ? 0 : 1;
  }
  return pts / SIMS;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pick = (r, items) => { let t = 0; items.forEach(x => { t += x[1]; }); let u = r() * t; for (const [v, w] of items) { u -= w; if (u < 0) return v; } return items[0][0]; };
  const sum = {smart: 0, naive: 0, n: 0, off: 0};
  doc.days.forEach((d, i) => {
    const r = E.dice(d.s, 0x7e57);
    const deficit = pick(r, DEFICITS);
    const them = 13 + 3 * Math.floor(r() * 5) + (r() < 0.4 ? 1 : 0) * 4;
    let best = null;
    for (let k = 0; k < TRIES; k++) {
      const sc = {o: d.o, d: d.d, us: them - deficit, them, t: 45 + 5 * Math.floor(r() * 27), b: 15 + Math.floor(r() * 41), to: Math.floor(r() * 4), s: d.s};
      const w = rate(sc, smart);
      const miss = w < TARGET[0] ? TARGET[0] - w : w > TARGET[1] ? w - TARGET[1] : 0;
      if (!best || miss < best.miss) best = {sc, w, miss};
      if (!miss) break;
    }
    Object.assign(d, {us: best.sc.us, them: best.sc.them, t: best.sc.t, b: best.sc.b, to: best.sc.to});
    const nv = rate(best.sc, naive);
    sum.smart += best.w; sum.naive += nv; sum.n++; if (best.miss) sum.off++;
    if (i < 8) console.log(`day ${i + 1}: ${d.o} vs ${d.d}, down ${deficit} (${best.sc.us}-${them}), ${Math.floor(best.sc.t / 60)}:${String(best.sc.t % 60).padStart(2, '0')}, own ${best.sc.b}, ${best.sc.to} TO -> smart ${best.w.toFixed(2)}, naive ${nv.toFixed(2)}`);
  });
  fs.writeFileSync(file, JSON.stringify(doc));
  console.log(`tuned ${sum.n} days: smart ${(sum.smart / sum.n).toFixed(3)}, naive ${(sum.naive / sum.n).toFixed(3)}; ${sum.off} outside ${TARGET.join('-')}`);
}
