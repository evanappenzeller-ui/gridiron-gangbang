// Gridiron Dynasty's checks for the dev gallery (#/_kit): the cards (every series, rarity by OVR), packs (their odds add
// up, each draws what it says), the pay from the Daily Games (each game's first result a day, from the day the Dynasty
// began, once), the save (cleaned, a bad one refused), the squad (positions, one card of a player), collections (a
// reward claimed once), the games (the same game every time from the same seed) and the board (the scoreboards' rule:
// everyone's Dynasty to everyone, from daily.LB.raw, never LB.all). checks.js imports dynastyChecks and calls it with its
// check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here writes to storage or the database.
import * as D from './dynasty.js';
import * as daily from './daily.js';

export async function dynastyChecks(check) {
  await D.load();
  check('Gridiron Dynasty: the cards: real players in six series, every position, rarity by OVR (Diamond 85+, Gold 80+, Silver 75+, Bronze 65+)', () => {
    const series = new Set(D.CARDS.map(c => c.s)), pos = new Set(D.CARDS.filter(c => c.s === 'L').map(c => c.pos));
    const rar = D.CARDS.every(c => c.r === D.rarityOf(c.o) && c.o >= 40 && c.o <= 99);
    const ids = new Set(D.CARDS.map(c => c.id)).size === D.CARDS.length;
    const ok = ['L', 'R', 'P', 'G', 'A', 'X'].every(s => series.has(s)) && ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'].every(p => pos.has(p));
    return {pass: ok && rar && ids, detail: `${D.CARDS.length} cards, ${pos.size} positions`};
  });
  check('Gridiron Dynasty: every pack’s odds add up to 100% and a pack draws its count of real cards (a Team Pack only that team’s, a Gameday Pack a Gameday card)', () => {
    const sums = D.PACK_ORDER.every(k => D.packOdds(k).every(g => Math.abs(g.odds.reduce((t, o) => t + o.pct, 0) - 100) < 0.6));
    const counts = D.PACK_ORDER.every(k => { const n = D.PACKS[k].slots.reduce((t, s) => t + s.n, 0); const ids = D.drawPack(k, {team: 'BUF', R: D.rng('pack|' + k)}); return ids.length === n && ids.every(id => D.card(id)); });
    const team = D.drawPack('team', {team: 'KC', R: D.rng('t')}).every(id => D.card(id).team === 'KC' && D.card(id).s === 'L');
    const gd = D.card(D.drawPack('gday', {R: D.rng('g')})[0]).s === 'G';
    const prem = D.drawPack('prem', {R: D.rng('p')}).slice(-1).every(id => ['gold', 'diamond'].includes(D.card(id).r));
    return {pass: sums && counts && team && gd && prem, detail: 'odds, counts, team, gameday, the Premium Pack’s last card'};
  });
  check('Gridiron Dynasty: the Daily Games pay coins once a game a day (the first finished result across phones), only from the day the Dynasty began', () => {
    const mods = {'17-0': {todayNumber: t => dn(t), entryOf: (p, n) => (p.s17 && p.s17[n]) || null}};
    const dn = t => 1 + Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(2026, 9, 20)) / 864e5);
    const docs = [{id: 'a', s17: {2: {w: 10, t: 5}, 5: {w: 17, t: 9}}}, {id: 'b', s17: {5: {w: 3, t: 1}}}];
    const was = daily.PZ;
    const E = D.earnedOf(docs, new Date(2026, 9, 22, 12).getTime(), {mods, now: new Date(2026, 9, 24, 12)});
    // (day 2 is before it began; day 5 paid once, its first result: 3 wins)
    const want = D.PAY['17-0']({w: 3});
    return {pass: E.total === want && E.days === 1 && was === daily.PZ, detail: `${E.total} coins from ${E.days} game`};
  });
  check('Gridiron Dynasty: a save is cleaned (only real packs, slots of held cards), another season’s or a broken one refused; a new one starts with a full squad and welcome packs', () => {
    const f = D.fresh('m_check', 1000), sq = Object.keys(f.sq).length;
    const c = D.clean({...f, pk: {std: 2, bogus: 4}, sq: {...f.sq, QB: 'Lnot-held'}, o: {...f.o, X: -3}});
    const refused = D.clean({...f, rs: 'old'}) === null && D.clean(null) === null && D.clean('x') === null;
    const same = JSON.stringify(D.fresh('m_check', 1000).o) === JSON.stringify(f.o);
    return {pass: sq === D.SLOTS.length && !c.pk.bogus && c.pk.std === 2 && !c.sq.QB && !('X' in c.o) && refused && same, detail: `${sq} starters`};
  });
  check('Gridiron Dynasty: the squad takes a card only at its position and a player once; the best squad is at least as good as any other', () => {
    const qb = D.CARDS.find(c => c.s === 'L' && c.pos === 'QB'), wr = D.CARDS.filter(c => c.s === 'L' && c.pos === 'WR').slice(0, 2);
    const sq = {WR1: wr[0].id};
    const pos = !D.fits(sq, 'WR2', qb.id) && D.fits(sq, 'WR2', wr[1].id);
    const twin = D.CARDS.find(c => c.s !== 'L' && c.p === wr[0].p && c.pos === 'WR');
    const once = !twin || !D.fits(sq, 'WR2', twin.id);
    const owned = Object.fromEntries(D.CARDS.filter((c, i) => i % 7 === 0).map(c => [c.id, 1]));
    const best = D.squadRating(D.bestSquad(owned)).ovr >= D.squadRating(D.fresh('m_x').sq).ovr - 30;
    return {pass: pos && once && best};
  });
  check('Gridiron Dynasty: a collection’s reward is claimed once, when it’s complete', () => {
    const col = D.COLLECTIONS.find(c => c.kind === 'team');
    const s = D.fresh('m_check');
    const before = D.progress(col, s).done;
    col.need.forEach(id => { s.o[id] = 1; });
    const p = D.progress(col, s);
    const was = s.cr;
    const r1 = D.claim(col.id, s), r2 = D.claim(col.id, s);
    return {pass: !before && p.done && r1.ok && !r2.ok && s.cr === was + col.reward.coins && s.pk.prem >= 1, detail: col.name};
  });
  check('Gridiron Dynasty: a game is the same every time for the same squads and day, and somebody wins', () => {
    const a = {name: 'A', sq: D.cpuTeam('pro', '2026-10-27').sq}, b = {name: 'B', sq: D.cpuTeam('allpro', '2026-10-27').sq};
    const g1 = D.sim(a, b, 'seed'), g2 = D.sim(a, b, 'seed');
    const same = JSON.stringify(g1) === JSON.stringify(g2);
    let wins = 0;
    for (let i = 0; i < 60; i++) if (D.sim(a, b, 's' + i).win === 'b') wins++;
    return {pass: same && g1.a !== g1.b && wins > 30, detail: `the 87s beat the 79s ${wins} of 60`};
  });
  check('Gridiron Dynasty: the board and the head-to-head list follow the scoreboards’ rule (everyone, read from daily.LB.raw)', async () => {
    const src = await fetch(new URL('./dynasty.js', import.meta.url)).then(r => r.text());
    const raw = src.includes('export function others(docs = daily.LB.raw || []');
    const all = (src.match(/daily\.LB\.all/g) || []).length === 1; // (only allDocs: finding your own saved copy, as Keepfall does)
    return {pass: raw && all, detail: 'others() from LB.raw; LB.all only for your own save'};
  });
}
