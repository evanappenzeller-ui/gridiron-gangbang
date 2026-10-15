// The Two-Minute Drill's baseline for the coach comp: how this game's play-callers typically come out on each
// tendency (drill-sim.js tendencies), into data/drill.json's coaches.base. Run by tools/drill/coaches.py after it writes
// the coaches; on its own: node tools/drill/comp_base.mjs data/drill.json.
//
// The game counts some things its own way (a route's depth, not where the ball was caught; its days are all comebacks,
// so two-point tries come up more), so a player's lean is read against how the game is usually played, as an NFL
// coach's is against the league (core/drill.js matchCoach). Usually played: the game's bot calling both sides, at
// skills from sloppy to sharp, on the first DAYS days. No huddle and timeouts are the same choices as the NFL's, so
// their baseline is the league's. Deterministic: the same file in, the same numbers out.
import fs from 'fs';
import * as E from '../../js/core/drill-sim.js';

const file = process.argv[2] || new URL('../../data/drill.json', import.meta.url).pathname;
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const DAYS = 40, GAMES = 15;
const sum = {};
E.TENDENCIES.forEach(k => { sum[k] = [0, 0]; });
for (let d = 1; d <= Math.min(DAYS, doc.days.length); d++) {
  for (let i = 0; i < GAMES; i++) {
    const s = E.finish(E.start(Object.assign({n: d}, doc.days[d - 1]), doc.teams), E.dice(d, i, 31), 0.3 + (i % 5) * 0.15, true);
    const f = E.tendencies(s);
    E.TENDENCIES.forEach(k => { sum[k][0] += f[k][0]; sum[k][1] += f[k][1]; });
  }
}
const L = doc.coaches.league, base = {};
E.TENDENCIES.forEach(k => {
  const own = sum[k][1] ? sum[k][0] / sum[k][1] : L[k];
  base[k] = ['hurry', 'timeout'].includes(k) ? L[k] : Math.round(Math.min(0.97, Math.max(0.03, own)) * 1e4) / 1e4;
});
doc.coaches.base = base;
fs.writeFileSync(file, JSON.stringify(doc));
console.log('comp baseline (this game) vs the league:', E.TENDENCIES.map(k => `${k} ${base[k]} / ${L[k]}`).join(', '));
