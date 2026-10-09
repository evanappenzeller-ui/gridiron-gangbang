// 17-0 checks for the dev gallery (#/_kit): data/seventeen.json's shape, the season rules of js/core/seventeen.js
// (wins, displayed scores and overtime, rank, the perfect lineup) and the picks it accepts from storage. checks.js
// (owner: core) imports seventeenChecks and calls it with its own check(name, fn) helper; every fn returns true or
// {pass, detail}. Nothing here writes to storage; the only read is the repo's own data/seventeen.json.
// Owner: 17-0.

import * as sv from './seventeen.js';

const POS = ['QB', 'RB', 'WR', 'WR', 'TE'];

export async function seventeenChecks(check) {
  let err = null;
  try { await sv.load(); } catch (e) { err = e; }
  const need = () => { if (err) throw new Error('seventeen.json did not load: ' + (err.message || err)); };

  // 1. Shape
  check('17-0: every board is 5 columns (QB RB WR WR TE) x 5 prices ($5-$1) of prime seasons, with 17 opponents', () => {
    need();
    const bad = [];
    const m = sv.DOC.model;
    if (!(isFinite(m.base) && ['QB', 'RB', 'WR', 'TE'].every(k => isFinite(m.w[k])))) bad.push('model');
    const ids = new Set();
    sv.boards().forEach(b => {
      if (ids.has(b.id) || !/^[a-z]{1,16}$/.test(b.id)) bad.push(`${b.id}: id`);
      ids.add(b.id);
      if (b.tiers.join() !== '5,4,3,2,1' || b.budget !== 15 || b.cols.length !== 5) bad.push(`${b.id}: tiers/budget/cols`);
      const names = new Set();
      b.cells.forEach((col, c) => col.forEach((p, r) => {
        if (col.length !== 5 || p.p !== POS[c] || !p.n || !p.s || !(p.y >= 2006 && p.y <= 2025) || !p.t || !p.f || !isFinite(p.imp) || !Array.isArray(p.line) || !p.line.length) bad.push(`${b.id} ${c},${r}`);
        if (!/^\d+$/.test(p.e || '')) bad.push(`${b.id}: ${p.n} has no ESPN id`);
        if (!sv.DOC.colors[p.f]) bad.push(`${b.id}: no colours for ${p.f}`);
        if (names.has(p.n)) bad.push(`${b.id}: ${p.n} twice`);
        names.add(p.n);
      }));
      if (b.sched.length !== 17) bad.push(`${b.id}: ${b.sched.length} games`);
      b.sched.forEach(g => { if (!isFinite(g.pf) || !isFinite(g.pa) || Math.abs(g.need - (g.pf - g.pa)) > 0.011 || !g.tn) bad.push(`${b.id}: ${g.y} ${g.t}`); });
      const keys = new Set(b.sched.map(g => g.y + g.f));
      if (keys.size !== 17) bad.push(`${b.id}: a team-season twice`);
    });
    return {pass: !bad.length && sv.boards().length >= 1, detail: bad.length ? bad.slice(0, 8).join('; ') : `${sv.boards().length} boards: ${sv.boards().map(b => b.name).join(', ')}`};
  });

  // 2. The perfect lineup
  check('17-0: on every board the best lineup under the cap goes 17-0, the all-$1 lineup does not, and the week-17 game is the hardest', () => {
    need();
    const out = [], bad = [];
    sv.boards().forEach(b => {
      const a = sv.all(b), top = a.list[0];
      const s = sv.season(b, top.pick), cheap = sv.season(b, [4, 4, 4, 4, 4]);
      const hardest = Math.max(...b.sched.map(g => g.need));
      if (!(top.cost <= b.budget && s.w === 17 && s.l === 0 && a.perfect >= 1 && cheap.w < 17 && b.sched[16].need === hardest)) bad.push(b.id);
      if (a.list.length !== 1753) bad.push(`${b.id}: ${a.list.length} legal lineups`);
      out.push(`${b.id} ${top.ppg.toFixed(1)} ppg (${a.perfect} go 17-0; $1s go ${sv.rec(cheap)})`);
    });
    return {pass: !bad.length, detail: (bad.length ? 'wrong: ' + bad.join(', ') + '; ' : '') + out.join(', ')};
  });

  // 3. Seasons: wins, scores, overtime
  check('17-0: a win is ppg > need; shown scores agree with the result, rounded, or split up and down when rounding would tie or flip it', () => {
    need();
    const bad = [];
    let n = 0, close = 0;
    sv.boards().forEach(b => {
      sv.all(b).list.filter((_, i) => i % 37 === 0).forEach(x => {
        const s = sv.season(b, x.pick);
        let w = 0;
        s.games.forEach(gm => {
          n++;
          if (gm.win) w++;
          if (gm.win !== (s.ppg > gm.g.need) || gm.win !== gm.us > gm.them) bad.push(`${b.id} wk${gm.wk}`);
          const x = s.ppg + gm.g.pa, y = gm.g.pf, us = Math.round(x), them = Math.round(y);
          const split = gm.win ? us <= them : them <= us;
          if (split) {
            close++;
            const ok = gm.win ? gm.us === Math.ceil(x) && gm.them === Math.floor(y) : gm.them === Math.ceil(y) && gm.us === Math.floor(x);
            if (!ok) bad.push(`${b.id} wk${gm.wk} close`);
          } else if (gm.us !== us || gm.them !== them) bad.push(`${b.id} wk${gm.wk} score`);
        });
        if (w !== s.w || s.w + s.l !== 17) bad.push(`${b.id} record`);
      });
    });
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `${n} games, ${close} split up and down`};
  });

  // 4. Cost, rank, sanitized picks
  check('17-0: cost and budget, rank (#1 is the best lineup), and picks from storage cleaned', () => {
    need();
    const b = sv.boards()[0];
    const best = sv.best(b), r1 = sv.rankOf(b, best.pick), rl = sv.rankOf(b, [4, 4, 4, 4, 4]);
    const costs = sv.cost(b, [0, 0, 0, 0, 0]) === 25 && sv.cost(b, [null, 1, null, 3, 4]) === 7 && !sv.fits(b, [0, 0, 0, 4, 4]) && sv.fits(b, [0, 1, 4, 4, 4]);
    const ranks = r1.rank === 1 && r1.of === 1753 && rl.rank > 1 && rl.rank <= 1753;
    const C = sv.cleanPick;
    const clean = C([0, 1, 2, 3, 4]).join() === '0,1,2,3,4' && C([0, 9, -1, 'x', 2.5]).join() === '0,,,,' && C([1, 2]) === null && C('01234') === null && C(null) === null;
    const full = sv.full([0, 1, 2, 3, 4]) && !sv.full([0, 1, null, 3, 4]) && !sv.full([0, 1]);
    return {pass: costs && ranks && clean && full, detail: `costs ${costs}, best #${r1.rank} of ${r1.of}, all-$1 #${rl.rank}, clean ${clean}, full ${full}`};
  });

  // 5. The prime-year rule's own example, and the share text
  check('17-0: Nick Chubb is his 2022 (1,525 rushing yards), not 2025; the share text carries the record and a link', () => {
    need();
    let chubb = null, board = null;
    sv.boards().forEach(b => b.cells.forEach(col => col.forEach(p => { if (p.n === 'Nick Chubb') { chubb = p; board = b; } })));
    const prime = !!chubb && chubb.y === 2022 && chubb.line.join(' ').includes('1,525 rush yds');
    const b = sv.boards()[0], best = sv.best(b), s = sv.season(b, best.pick);
    const t = sv.shareText(b, best.pick, s);
    const share = t.includes('17–0') && t.includes(`/puzzles/17-0/${b.id}`) && t.split('\n').length === 4;
    return {pass: prime && share, detail: `${chubb ? `${chubb.n} ${chubb.y} (${board.name}): ${chubb.line.join(' · ')}` : 'no Nick Chubb'}; share ${share}`};
  });
}
