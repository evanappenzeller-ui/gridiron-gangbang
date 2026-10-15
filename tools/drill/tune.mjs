// Sets each Two-Minute Drill day's situation (the score, the clock, the ball, your timeouts) with the game's own engine.
// Run by tools/drill/build.py after it writes data/drill.json; on its own: node tools/drill/tune.mjs data/drill.json.
//
// For each day: the deficit and their timeouts from its seed (DEFICITS), then a difficulty knob (more time, a better
// spot, more of your timeouts as it rises, with a little of the day's own jitter) searched until a good play-caller
// (smart: drill-sim.js's bots on both sides of the ball, which read the odds and mind the clock, taking their first
// choice most of the time) scores TARGET over SIMS games with the day's two teams, a win counting 1 and a tie (it went
// to overtime) a half. The whole game counts: score with time left and they get the ball back. A careless player
// (naive: any play and any defense at random, sane with the clock) is reported too.
// Deterministic: the same file in, the same days out.
import fs from 'fs';
import * as E from '../../js/core/drill-sim.js';

const file = process.argv[2] || new URL('../../data/drill.json', import.meta.url).pathname;
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const T = doc.teams;
const SIMS = 200, STEPS = 7;
const TARGET = 0.45, BAND = 0.05;
const DEFICITS = [[2, 1], [3, 1.2], [4, 1.5], [5, 0.8], [6, 1.3], [7, 1.3]];

export const smart = (s, r) => (s.poss === 'them' && s.phase !== 'pat' ? E.defBot(s, r, 0.8) : E.bot(s, r, 0.8, true));
export function naive(s, r) {
  const o = E.options(s);
  if (s.poss === 'them' && s.phase !== 'pat') {
    if (o.timeout && s.them > s.us && s.clock <= 60) return E.tok.timeout;
    return E.tok.def(E.DEF_CALLS[Math.floor(r() * E.DEF_CALLS.length)]);
  }
  if (o.kneel) return E.tok.kneel;
  if (s.phase === 'pat' && r() < 0.6) return E.tok.kick;
  if (o.fg && o.fg.p >= 0.4 && (s.down === 4 || s.clock <= 12)) return s.running && o.timeout ? E.tok.timeout : E.tok.fg;
  if (s.running && s.clock <= 30 && o.timeout) return E.tok.timeout;
  if (s.running && s.clock <= E.HURRY + 1 && o.spike) return E.tok.spike;
  const c = E.candidates(s, true);
  return c[Math.floor(r() * c.length)].token;
}
export function drive(sc, bot, seed) {
  const s = E.start(sc, T);
  const r = E.dice(seed, 77);
  for (let guard = 0; !s.result && guard < 250; guard++) {
    if (!E.act(s, bot(s, r))) E.act(s, s.poss === 'them' ? E.tok.def('c3') : E.tok.run('s')) || E.act(s, E.tok.kick);
  }
  return s;
}
function rate(sc, bot) {
  let pts = 0;
  for (let i = 0; i < SIMS; i++) {
    const s = drive(Object.assign({}, sc, {s: (sc.s + i * 7919) >>> 0}), bot, i);
    pts += s.result === 'W' ? 1 : s.result === 'T' ? 0.5 : 0;
  }
  return pts / SIMS;
}
const round5 = x => 5 * Math.round(x / 5);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** The situation at difficulty knob k (0 hardest, 1 easiest) with the day's jitter j. */
function spot(d, them, deficit, dto, k, j) {
  return {
    o: d.o, d: d.d, us: them - deficit, them, s: d.s, dto,
    t: clamp(round5(55 + 115 * k + j.t), 45, 180),
    b: clamp(Math.round(14 + 36 * k + j.b), 10, 60),
    to: clamp(Math.round(0.3 + 2.6 * k + j.to), 0, 3)
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pick = (r, items) => { let t = 0; items.forEach(x => { t += x[1]; }); let u = r() * t; for (const [v, w] of items) { u -= w; if (u < 0) return v; } return items[0][0]; };
  const sum = {smart: 0, naive: 0, n: 0, off: 0};
  doc.days.forEach((d, i) => {
    const r = E.dice(d.s, 0x7e57);
    const deficit = pick(r, DEFICITS);
    const them = 13 + 3 * Math.floor(r() * 5) + (r() < 0.4 ? 4 : 0);
    const j = {t: 30 * (r() - 0.5), b: 10 * (r() - 0.5), to: r() - 0.5};
    const dto = 1 + Math.floor(r() * 3);
    let lo = 0, hi = 1, best = null;
    for (let step = 0; step < STEPS; step++) {
      const k = (lo + hi) / 2, sc = spot(d, them, deficit, dto, k, j), w = rate(sc, smart);
      if (!best || Math.abs(w - TARGET) < Math.abs(best.w - TARGET)) best = {sc, w};
      if (Math.abs(w - TARGET) <= BAND / 2) break;
      if (w < TARGET) lo = k; else hi = k;
    }
    Object.assign(d, {us: best.sc.us, them: best.sc.them, t: best.sc.t, b: best.sc.b, to: best.sc.to, dto});
    const nv = rate(best.sc, naive);
    sum.smart += best.w; sum.naive += nv; sum.n++;
    if (Math.abs(best.w - TARGET) > BAND) sum.off++;
    if (i < 8) console.log(`day ${i + 1}: ${d.o} vs ${d.d}, down ${deficit} (${best.sc.us}-${them}), ${Math.floor(best.sc.t / 60)}:${String(best.sc.t % 60).padStart(2, '0')}, ball on ${best.sc.b}, ${best.sc.to}-${dto} TO -> smart ${best.w.toFixed(2)}, naive ${nv.toFixed(2)}`);
  });
  fs.writeFileSync(file, JSON.stringify(doc));
  console.log(`tuned ${sum.n} days: smart ${(sum.smart / sum.n).toFixed(3)}, naive ${(sum.naive / sum.n).toFixed(3)}; ${sum.off} more than ${BAND} from ${TARGET}`);
}
