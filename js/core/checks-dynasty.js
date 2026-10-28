// Gridiron Dynasty's checks for the dev gallery (#/_kit): it's Evan's and Ryan Stewart's alone (Oct 28 2026), the cards (every series,
// rarity by OVR; the Coach and Stadium cards), packs (their odds add up, each draws what it says), the pay from the Daily
// Games (each game's first result a day, from the day the Dynasty began, once), the save (cleaned, a bad one refused,
// a starter deck that's legal), collections (a reward claimed once), the battles (Pokémon TCG Pocket's rules: decks,
// types and weakness, touchdowns, the same game from the same moves) and the board (the scoreboards' rule: everyone's
// Dynasty to everyone, from daily.LB.raw, never LB.all). checks.js imports dynastyChecks and calls it with its
// check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here writes to storage or the database.
import * as D from './dynasty.js';
import * as daily from './daily.js';
import * as B from './dynasty-battle.js';

export async function dynastyChecks(check) {
  await D.load();
  check('Gridiron Dynasty is Evan’s and Ryan Stewart’s alone (his ask, Oct 28 2026: "Make available to Evan and Ryan Stewart’s profiles only"): by his member id and Ryan Stewart’s app-user id, its case and pages theirs, and only their Dynasties to challenge or on the board', async () => {
    const [app, games, data, F] = await Promise.all([import('../app.js'), import('../views/games.js'), import('./data.js'), import('./features.js')]);
    const ryan = data.USERS.find(u => u.id === 'ryan-stewart'), dow = data.USERS.find(u => u.id === 'ryan-dow');
    const who = [F.dynastyOpen('evan'), F.dynastyOpen('mason'), F.dynastyOpen(null, ryan), F.dynastyOpen(null, dow), F.dynastyOpen(null, null)];
    const lists = ['evan', 'mason'].map(w => games.gamesFor(w).some(g => g.id === 'dynasty'));
    const keys = [F.dynastyKey('m_evan'), F.dynastyKey('u_ryan-stewart'), F.dynastyKey('m_mason'), F.dynastyKey('u_ryan-dow'), F.dynastyKey('g_72_79')];
    const mine = F.dynastyOpen(), r = app.parseRoute('/puzzles/dynasty'), rb = app.parseRoute('/puzzles/dynasty/battle/b1234abcd');
    const routed = mine ? r.view === 'dynasty' && rb.view === 'dynasty-battle' && rb.open === 'cover' : r.view !== 'dynasty' && rb.view !== 'dynasty-battle';
    const shown = D.others(daily.LB.raw || [], {withMe: true}).every(o => F.dynastyKey(o.key));
    return {pass: who.join() === 'true,false,true,false,false' && lists.join() === 'true,false' && keys.join() === 'true,true,false,false,false' && routed && D.mayPlay() === mine && shown,
      detail: `Evan, Mason, Ryan S, Ryan D, a guest: ${who.join(', ')}`};
  });
  check('Gridiron Dynasty: the cards: real players in six series, every position, rarity by OVR (Diamond 85+, Gold 80+, Silver 75+, Bronze 65+)', () => {
    const series = new Set(D.CARDS.map(c => c.s)), pos = new Set(D.CARDS.filter(c => c.s === 'L').map(c => c.pos));
    const rar = D.CARDS.every(c => c.r === D.rarityOf(c.o) && c.o >= 40 && c.o <= 99);
    const ids = new Set(D.CARDS.map(c => c.id)).size === D.CARDS.length;
    const ok = ['L', 'R', 'P', 'G', 'A', 'X'].every(s => series.has(s)) && ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'].every(p => pos.has(p));
    const tr = D.TRAINER_IDS.length >= 10 && D.TRAINER_IDS.every(id => D.trainer(id).name && ['silver', 'gold'].includes(D.trainer(id).r));
    return {pass: ok && rar && ids && tr, detail: `${D.CARDS.length} cards, ${pos.size} positions, ${D.TRAINER_IDS.length} Coach and Stadium cards`};
  });
  check('Gridiron Dynasty: every pack’s odds add up to 100% and a pack draws its count of real cards (a Team Pack only that team’s, a Gameday Pack a Gameday card)', () => {
    const sums = D.PACK_ORDER.every(k => D.packOdds(k).every(g => Math.abs(g.odds.reduce((t, o) => t + o.pct, 0) - 100) < 0.6));
    const counts = D.PACK_ORDER.every(k => { const n = D.PACKS[k].slots.reduce((t, s) => t + s.n, 0); const ids = D.drawPack(k, {team: 'BUF', R: D.rng('pack|' + k)}); return ids.length === n && ids.every(D.isCard); });
    const team = D.drawPack('team', {team: 'KC', R: D.rng('t')}).every(id => D.trainer(id) || (D.card(id).team === 'KC' && D.card(id).s === 'L'));
    const trainerSlot = D.drawPack('std', {R: D.rng('s')}).filter(id => D.trainer(id)).length === 1;
    const gd = D.card(D.drawPack('gday', {R: D.rng('g')})[0]).s === 'G';
    const prem = D.drawPack('prem', {R: D.rng('p')}).slice(-1).every(id => ['gold', 'diamond'].includes(D.card(id).r));
    return {pass: sums && counts && team && gd && prem && trainerSlot, detail: 'odds, counts, team, gameday, the Premium Pack’s last card, a Coach or Stadium card a Standard Pack'};
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
  check('Gridiron Dynasty: a save is cleaned (only real packs, a deck of 20 at most), another season’s or a broken one refused; a new one starts with a legal 20-card deck (starter Coach cards in it) and welcome packs', () => {
    const f = D.fresh('m_check', 1000), deck = B.checkDeck(f.dk, f.o);
    const c = D.clean({...f, pk: {std: 2, bogus: 4}, dk: [...f.dk, ...f.dk], o: {...f.o, X: -3}, bt: {x: 'w', y: 'nope'}});
    const refused = D.clean({...f, rs: 'old'}) === null && D.clean(null) === null && D.clean('x') === null;
    const same = JSON.stringify(D.fresh('m_check', 1000).o) === JSON.stringify(f.o);
    return {pass: deck.ok && f.dk.some(id => D.trainer(id)) && !c.pk.bogus && c.pk.std === 2 && c.dk.length === B.DECK_SIZE && !('X' in c.o) && c.bt.x === 'w' && !c.bt.y && refused && same,
      detail: `starter deck ${deck.ok ? 'legal' : deck.why}, types ${deck.types.join('')}`};
  });
  check('Gridiron Dynasty battles: a deck is 20 cards, at most 2 of any player (a Live and a Gameday card of him count together) or card, with a Basic player; the best deck built from a collection is legal', () => {
    const f = D.fresh('m_deck', 1000), ok = B.checkDeck(f.dk).ok;
    const short = !B.checkDeck(f.dk.slice(1)).ok;
    const g = D.CARDS.find(c => c.s === 'G'), l = D.CARDS.find(c => c.s === 'L' && c.p === g.p);
    const three = !B.checkDeck([l.id, l.id, g.id, ...f.dk.slice(3)]).ok;
    const noBasic = !B.checkDeck(Array(20).fill(0).map((_, i) => D.TRAINER_IDS[i % D.TRAINER_IDS.length])).ok;
    const owned = Object.fromEntries(D.CARDS.filter((c, i) => i % 5 === 0).map(c => [c.id, 2]).concat(D.TRAINER_IDS.map(id => [id, 2])));
    const auto = B.checkDeck(D.autoDeck(owned), owned).ok;
    return {pass: ok && short && three && noBasic && auto};
  });
  check('Gridiron Dynasty battles: every player card has a type, HP and two attacks from his rating; Air beats Blitz, Ground beats Coverage, Blitz beats Ground, Coverage beats Air (+20); Legends and Prime cards are worth 2 touchdowns', () => {
    const all = D.CARDS.every(c => { const s = B.stats(c.id); return s && s.hp >= 40 && s.attacks.length === 2 && s.attacks.every(a => a.dmg > 0 && a.cost.length); });
    const weak = B.WEAK.A === 'C' && B.WEAK.G === 'B' && B.WEAK.B === 'A' && B.WEAK.C === 'G';
    const ex = D.CARDS.filter(c => c.s === 'X' || c.s === 'P').every(c => B.stats(c.id).ex) && D.CARDS.filter(c => c.s === 'L').every(c => !B.stats(c.id).ex);
    const evo = D.CARDS.filter(c => c.s === 'G' || c.s === 'P').every(c => B.stats(c.id).stage === 1);
    return {pass: all && weak && ex && evo, detail: `${D.CARDS.length} battle cards`};
  });
  check('Gridiron Dynasty battles: a game played out from both decks and moves is the same game when replayed (every phone sees the same), and it ends with a winner by three touchdowns', () => {
    const d0 = D.fresh('m_a', 1000).dk, d1 = D.fresh('m_b', 1000).dk, seed = 'bcheck1';
    const G = B.newGame(seed, [d0, d1]), log = [[], []], cur = [[], []];
    for (let guard = 0; G.phase !== 'over' && guard < 3000; guard++) {
      const who = B.toMove(G), me = G.p[who];
      let m;
      if (G.phase === 'setup') { const b = me.hand.filter(B.isBasic); m = {a: 'setup', act: b[0], bench: b.slice(1, 4)}; }
      else if (me.promote) m = {a: 'promote', u: me.bench[0].u};
      else if (me.hand.some(id => B.isBasic(id)) && me.bench.length < 3) m = {a: 'bench', id: me.hand.find(B.isBasic)};
      else if (me.en && !me.used.energy) m = {a: 'energy', on: me.active.u};
      else m = [1, 0].map(n => ({a: 'attack', n})).find(x => B.check(G, who, x).ok) || {a: 'end'};
      if (!B.play(G, who, m).ok) return {pass: false, detail: 'a move was refused: ' + JSON.stringify(m)};
      if (m.a === 'setup') log[who].push(m);
      else { cur[who].push(m); if (G.phase === 'over' || G.cur !== who) { log[who].push(cur[who]); cur[who] = []; } }
    }
    const R = B.replay(seed, [d0, d1], log);
    const same = !R.bad && R.G.phase === 'over' && JSON.stringify(R.G.p.map(p => p.pts)) === JSON.stringify(G.p.map(p => p.pts)) && R.G.over.win === G.over.win;
    return {pass: G.phase === 'over' && same && (G.over.why === 'points' || G.over.why === 'empty'), detail: `${G.turn} turns, ${G.p[0].pts}–${G.p[1].pts}, ${G.over.why}`};
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
  check('Gridiron Dynasty: the board, who you can challenge and the other side of a battle follow the scoreboards’ rule (everyone, read from daily.LB.raw)', async () => {
    const [src, msrc] = await Promise.all(['./dynasty.js', './dynasty-match.js'].map(f => fetch(new URL(f, import.meta.url)).then(r => r.text())));
    const raw = src.includes('export function others(docs = daily.LB.raw || []') && msrc.includes('for (const p of daily.LB.raw || [])');
    // (LB.all only in allDocs: finding your own saved copy, as Keepfall does)
    const all = (src.match(/daily\.LB\.all/g) || []).length === 1 && (msrc.match(/daily\.LB\.all/g) || []).length === 1;
    return {pass: raw && all, detail: 'others() and the matches from LB.raw; LB.all only for your own saves'};
  });
}
