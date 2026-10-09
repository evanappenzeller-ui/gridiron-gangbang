// 17-0 checks for the dev gallery (#/_kit): data/seventeen.json's daily boards, the day count, the season rules of
// js/core/seventeen.js (wins, displayed scores, rank, the perfect lineup), the picks it accepts from storage and the
// share text, and the league scoreboard's rows (on crafted board docs). checks.js (owner: core) imports seventeenChecks
// and calls it with its own check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here writes to
// storage or the database; the only read is the repo's own data/seventeen.json. Owner: 17-0.

import * as sv from './seventeen.js';

const POS = ['QB', 'RB', 'WR', 'WR', 'TE'];
const HEADSHOT = /^https:\/\/static\.www\.nfl\.com\/image\/(upload|private)\/f_auto,q_auto\/league\/[a-z0-9]+$/;

export async function seventeenChecks(check) {
  let err = null;
  try { await sv.load(); } catch (e) { err = e; }
  const need = () => { if (err) throw new Error('seventeen.json did not load: ' + (err.message || err)); };
  const days = () => sv.DOC.days.length;

  // 1. Shape
  check('17-0: every daily board is 25 different players (QB RB WR WR TE x $5-$1, each in his prime, with headshots) and 17 different opponents', () => {
    need();
    const D = sv.DOC, bad = [];
    const m = D.model;
    if (!(isFinite(m.base) && ['QB', 'RB', 'WR', 'TE'].every(k => isFinite(m.w[k])))) bad.push('model');
    if (D.tiers.join() !== '5,4,3,2,1' || D.budget !== 15 || D.cols.length !== 5) bad.push('tiers/budget/cols');
    D.cards.forEach((p, i) => {
      if (!p.n || !(p.y >= 2006 && p.y <= 2025) || !p.f || !p.tn || !isFinite(p.imp) || !Array.isArray(p.line) || !p.line.length || p.n.indexOf(' ') < 1) bad.push(`card ${i}`);
      if (!HEADSHOT.test(p.h || '')) bad.push(`${p.n}: no nflverse headshot`);
      if (!/^\d+$/.test(p.e || '')) bad.push(`${p.n}: no ESPN id (the backup headshot)`);
      if (!D.colors[p.f]) bad.push(`no colours for ${p.f}`);
    });
    D.teams.forEach((t, i) => { if (t.length !== 7 || !isFinite(t[3]) || !isFinite(t[4]) || Math.abs(t[5] - (t[3] - t[4])) > 0.011 || !t[2]) bad.push(`team ${i}`); });
    D.days.forEach((row, d) => {
      if (row.length !== 42 || row.some((x, k) => !Number.isInteger(x) || x < 0 || x >= (k < 25 ? D.cards.length : D.teams.length))) { bad.push(`day ${d + 1}: indexes`); return; }
      const cards = row.slice(0, 25).map(i => D.cards[i]);
      if (new Set(cards.map(p => p.n)).size !== 25) bad.push(`day ${d + 1}: a name twice`);
      if (cards.some((p, k) => p.p !== POS[Math.floor(k / 5)])) bad.push(`day ${d + 1}: positions`);
      if (new Set(row.slice(25)).size !== 17) bad.push(`day ${d + 1}: an opponent twice`);
    });
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 8).join('; ') : `${days()} boards from ${D.start}, ${D.cards.length} prime seasons, ${D.teams.length} opponents`};
  });

  // 2. The perfect lineup
  check('17-0: on every board the best lineup under the cap goes 17-0 (at most 3 do), the all-$1 lineup does not, and week 17 is the hardest game', () => {
    need();
    const bad = [], counts = {};
    let lo = Infinity, hi = -Infinity;
    for (let n = 1; n <= days(); n++) {
      const b = sv.board(n), a = sv.all(b), top = a.list[0];
      const s = sv.season(b, top.pick), cheap = sv.season(b, [4, 4, 4, 4, 4]);
      const hardest = Math.max(...b.sched.map(g => g.need));
      if (!(top.cost <= b.budget && s.w === 17 && a.perfect >= 1 && a.perfect <= 3 && cheap.w < 17 && b.sched[16].need === hardest && a.list.length === 1753)) bad.push(n);
      counts[a.perfect] = (counts[a.perfect] || 0) + 1;
      lo = Math.min(lo, top.ppg); hi = Math.max(hi, top.ppg);
    }
    return {pass: !bad.length, detail: (bad.length ? 'wrong boards: ' + bad.slice(0, 10).join(', ') + '; ' : '') + `perfect lineups per board ${JSON.stringify(counts)}, perfect teams ${lo.toFixed(1)}-${hi.toFixed(1)} ppg`};
  });

  // 3. Days
  check('17-0: board 1 on the start date, a new board at local midnight, wrapping around after the last', () => {
    need();
    const [y, m, d] = sv.DOC.start.split('-').map(Number);
    const at = (dd, h) => new Date(y, m - 1, d + dd, h);
    const nums = sv.todayNumber(at(0, 0)) === 1 && sv.todayNumber(at(0, 23)) === 1 && sv.todayNumber(at(1, 0)) === 2 && sv.todayNumber(at(-5, 12)) === 1
      && sv.todayNumber(at(days(), 12)) === days() + 1;
    const dates = sv.dateOf(1).getTime() === at(0, 0).getTime() && sv.dateOf(3).getDate() === at(2, 0).getDate();
    const wrap = sv.board(days() + 1).cells[0][0] === sv.board(1).cells[0][0] && sv.board(days() + 1).n === days() + 1;
    const today = sv.today().n === sv.todayNumber();
    return {pass: nums && dates && wrap && today, detail: `numbers ${nums}, dates ${dates}, wrap ${wrap}; today is board ${sv.todayNumber()} (${sv.dayLabel(sv.todayNumber())})`};
  });

  // 4. Seasons: wins, scores
  check('17-0: a win is ppg > need; shown scores agree with the result, rounded, or split up and down when rounding would tie or flip it', () => {
    need();
    const bad = [];
    let n = 0, close = 0;
    for (let d = 1; d <= Math.min(days(), 30); d++) {
      const b = sv.board(d);
      sv.all(b).list.filter((_, i) => i % 97 === 0).forEach(x => {
        const s = sv.season(b, x.pick);
        let w = 0;
        s.games.forEach(gm => {
          n++;
          if (gm.win) w++;
          if (gm.win !== (s.ppg > gm.g.need) || gm.win !== gm.us > gm.them) bad.push(`${d} wk${gm.wk}`);
          const xx = s.ppg + gm.g.pa, yy = gm.g.pf, us = Math.round(xx), them = Math.round(yy);
          if (gm.win ? us <= them : them <= us) {
            close++;
            const ok = gm.win ? gm.us === Math.ceil(xx) && gm.them === Math.floor(yy) : gm.them === Math.ceil(yy) && gm.us === Math.floor(xx);
            if (!ok) bad.push(`${d} wk${gm.wk} close`);
          } else if (gm.us !== us || gm.them !== them) bad.push(`${d} wk${gm.wk} score`);
        });
        if (w !== s.w || s.w + s.l !== 17) bad.push(`${d} record`);
      });
    }
    return {pass: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : `${n} games on 30 boards, ${close} split up and down`};
  });

  // 5. Cost, rank, sanitized picks
  check('17-0: cost and budget, rank (#1 is the best lineup), and picks from storage cleaned', () => {
    need();
    const b = sv.board(1);
    const top = sv.best(b), r1 = sv.rankOf(b, top.pick), rl = sv.rankOf(b, [4, 4, 4, 4, 4]);
    const costs = sv.cost(b, [0, 0, 0, 0, 0]) === 25 && sv.cost(b, [null, 1, null, 3, 4]) === 7 && !sv.fits(b, [0, 0, 0, 4, 4]) && sv.fits(b, [0, 1, 4, 4, 4]);
    const ranks = r1.rank === 1 && r1.of === 1753 && rl.rank > 1 && rl.rank <= 1753;
    const C = sv.cleanPick;
    const clean = C([0, 1, 2, 3, 4]).join() === '0,1,2,3,4' && C([0, 9, -1, 'x', 2.5]).join() === '0,,,,' && C([1, 2]) === null && C('01234') === null && C(null) === null;
    const full = sv.full([0, 1, 2, 3, 4]) && !sv.full([0, 1, null, 3, 4]) && !sv.full([0, 1]);
    return {pass: costs && ranks && clean && full, detail: `costs ${costs}, best #${r1.rank} of ${r1.of}, all-$1 #${rl.rank}, clean ${clean}, full ${full}`};
  });

  // 6. The prime-year rule's own example, and the share text
  check('17-0: Nick Chubb is his 2022 (1,525 rushing yards); the share text has the record, 17 squares and a link, and no player names', () => {
    need();
    const chubb = sv.DOC.cards.find(p => p.n === 'Nick Chubb');
    const prime = !!chubb && chubb.y === 2022 && chubb.line.join(' ').includes('1,525 rush yds');
    const b = sv.board(1), top = sv.best(b), s = sv.season(b, top.pick);
    const t = sv.shareText(b, s, top.pick);
    const names = b.cells.flat().filter(p => t.includes(p.n.split(' ').pop()));
    const squares = (t.match(/🟩|🟥/g) || []).length;
    const share = t.includes('17–0 #1') && t.includes('17–0 🏆') && squares === 17 && t.includes('/puzzles/17-0') && !names.length;
    return {pass: prime && share, detail: `${chubb ? `${chubb.n} ${chubb.y}: ${chubb.line.join(' · ')}` : 'no Nick Chubb in the pool'}; share ${share}${names.length ? ' (names ' + names.map(p => p.n).join(', ') + ')' : ''}`};
  });

  // 7. The scoreboard
  check('17-0: the scoreboard keeps one season per member per day (the first posted), drops bad entries, ranks by wins then PPG (ties share a rank), and All-time adds the days up', () => {
    need();
    const docs = [
      {id: 'a', nick: 'Ben', s17: {1: {w: 17, l: 0, p: 33.4, r: 1, t: 10}}},
      {id: 'b', nick: 'Mitch', s17: {1: {w: 12, l: 5, p: 27.1, r: 210, t: 20}, 2: {w: 10, l: 7, p: 26, r: 300, t: 5}}},
      {id: 'c', nick: 'Mitch', s17: {1: {w: 16, l: 1, p: 31, r: 5, t: 30}}}, // his second phone, later: doesn't count
      {id: 'd', nick: 'Jacob', s17: {1: {w: 12, l: 5, p: 27.1, r: 210, t: 15}}},
      {id: 'e', nick: 'Nobody Special', s17: {1: {w: 20, l: 0}, 2: {w: '9', l: 8}}}, // not a season
      {id: 'f', nick: 'Sayer', days: {}}
    ];
    const sig = rows => rows.map(r => `${r.rank}.${r.name} ${r.w}-${r.l}`).join(', ');
    const t1 = sv.boardRows('today', 1, docs), a2 = sv.boardRows('all', 2, docs), a1 = sv.boardRows('all', 1, docs);
    const today = sig(t1) === '1.Ben 17-0, 2.Mitch 12-5, 2.Jacob 12-5' && t1[1].uid === 'b' && t1[1].p === 27.1 && t1[0].r === 1;
    const all = sig(a2) === '1.Mitch 22-12, 2.Ben 17-0, 3.Jacob 12-5' && a2[0].seasons === 2 && a2[1].perfect === 1 && sig(a1) === '1.Ben 17-0, 2.Mitch 12-5, 2.Jacob 12-5';
    const clean = sv.entryOf(docs[4], 1) === null && sv.entryOf(docs[4], 2) === null && sv.entryOf(docs[5], 1) === null && sv.entryOf(docs[0], 1).w === 17;
    return {pass: today && all && clean, detail: `today: ${sig(t1)}; all-time: ${sig(a2)}; bad entries dropped ${clean}`};
  });
}
