// Gridiron Dynasty's checks for the dev gallery (#/_kit): it's Evan's and Ryan Stewart's alone (Oct 28 2026), the cards (every series,
// rarity on the real cards' scale; the Coach and Stadium cards), packs (their odds add up, each draws what it says), the pay from the Daily
// Games (each game's first result a day, from the day the Dynasty began, once), the save (cleaned, a bad one refused,
// a Starter Pack of 15 Common, 4 Rare and an Epic-or-better player, and a legal deck from it), collections (a reward claimed once), the battles (Pokémon TCG Pocket's rules: decks,
// types and weakness, touchdowns, the same game from the same moves) and the board (the scoreboards' rule: everyone's
// Dynasty to everyone, from daily.LB.raw, never LB.all). checks.js imports dynastyChecks and calls it with its
// check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here writes to storage or the database.
import * as D from './dynasty.js';
import * as daily from './daily.js';
import * as B from './dynasty-battle.js';

// (a new Dynasty with its Starter Pack opened, the same for a key every time: its deck built from what came out)
const started = key => {
  const s = D.fresh(key, 1000);
  D.drawPack('start', {R: D.rng('starter|' + key)}).forEach(id => { s.o[id] = (s.o[id] || 0) + 1; });
  delete s.pk.start; s.dk = D.autoDeck(s.o);
  return s;
};

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
  check('Gridiron Dynasty: the cards: real players in six series, every position, one card a player (the owner, Nov 2 2026: "There should be no two cards for the same player ... common (79 overall or less ...), epic (80-89), legendary (90-95), mythic (96+)"): his best card, the rest aliases of it; rarity by OVR alone; every rarity of active players has cards to draw', () => {
    const series = new Set(D.CARDS.map(c => c.s)), pos = new Set(D.CARDS.filter(c => c.s === 'L').map(c => c.pos));
    const rar = D.CARDS.every(c => c.r === D.rarityOf(c.o) && c.o >= 40 && c.o <= 99);
    const one = new Set(D.CARDS.map(c => c.p)).size === D.CARDS.length && D.ALIAS.size > 0
      && [...D.ALIAS].every(([old, to]) => D.card(old) && D.card(to) && D.card(old).p === D.card(to).p && D.card(old).o <= D.card(to).o && D.CARDS.includes(D.card(to)) && !D.CARDS.includes(D.card(old)));
    const live = D.RARITY.map(r => D.CARDS.filter(c => c.s !== 'X' && c.r === r).length), drawable = live.every(n => n > 0);
    const ids = new Set(D.CARDS.map(c => c.id)).size === D.CARDS.length;
    const ok = ['L', 'R', 'P', 'G', 'A', 'X'].every(s => series.has(s)) && ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'].every(p => pos.has(p));
    const tr = D.TRAINER_IDS.length >= 10 && D.TRAINER_IDS.every(id => D.trainer(id).name && ['epic', 'legendary'].includes(D.trainer(id).r));
    const names = D.RARITY.join() === 'common,epic,legendary,mythic' && [79, 80, 89, 90, 95, 96].map(o => D.rarityOf(o)).join() === 'common,epic,epic,legendary,legendary,mythic';
    return {pass: ok && rar && one && ids && tr && names && drawable,
      detail: `${D.CARDS.length} cards (${D.ALIAS.size} retired into them), ${pos.size} positions, ${D.TRAINER_IDS.length} Coach and Stadium cards; active players ${D.RARITY.map((r, i) => `${r} ${live[i]}`).join(', ')}`};
  });
  check('Gridiron Rivals: one card a player keeps every save whole: a retired card’s copies fold onto his kept card (in the collection, the deck, the new marks and the latest pulls), the deck stays legal, folding twice changes nothing, and an old battle’s cards still resolve', () => {
    const [old, to] = [...D.ALIAS][0], f = D.fresh('m_fold', 1000);
    D.CARDS.filter(c => c.s === 'L' && c.p !== D.card(to).p).slice(0, 16).forEach(c => { f.o[c.id] = 2; });
    f.o[old] = 2; f.o[to] = 1; f.nw = [old]; f.lp = [old, to]; f.dk = [old, old, ...D.autoDeck(f.o).filter(id => id !== old && id !== to)].slice(0, B.DECK_SIZE);
    const c = D.clean(f), again = JSON.stringify(c), changed = D.fold(c);
    const pass = !(old in c.o) && c.o[to] === 3 && c.nw.join() === to && c.lp.join() === [to, to].join() && !c.dk.includes(old)
      && B.checkDeck(c.dk, c.o).ok && !changed && JSON.stringify(c) === again && !!D.card(old) && !!B.stats(old);
    return {pass, detail: `${D.card(old).name}: ${old} → ${to}, ${c.o[to]} copies`};
  });
  check('Gridiron Dynasty: three packs on sale (the owner, Nov 2 2026: "There should only be 3 available packs"): Standard (the free one a day), Team (fewer cards, all the team picked), Epic (every card Epic or better, earned in Solo and rewards, or bought); the Gameday and Legends Packs retired, never sold or opened, one held becoming Epic Packs; no pack holds the same card or player twice', () => {
    const three = D.PACK_ORDER.join() === 'std,team,prem' && D.DAILY_PACK === 'std' && D.PACKS.prem.name === 'Epic Pack';
    const size = k => D.PACKS[k].slots.reduce((t, x) => t + x.n, 0), fewer = size('team') < size('std');
    const s = D.fresh('m_ret', 1000); s.cr = 1e6; s.pk = {gday: 2, leg: 1, std: 1};
    const c = D.clean(s), held = c.pk.prem === 4 && !c.pk.gday && !c.pk.leg && c.pk.std === 1;
    const shut = !D.buy('leg', c).ok && !D.buy('gday', c).ok && !D.open('leg', {free: true}, c).ok;
    const rewards = D.COLLECTIONS.every(col => Object.keys(col.reward.packs || {}).every(k => D.PACK_ORDER.includes(k)))
      && [5, 10, 15, 20, 25, 30].every(n => Object.keys(D.ladderPay(n).first || {}).every(k => D.PACK_ORDER.includes(k)))
      && Object.values(D.SOLO_PAY).every(p => Object.keys(p.first).every(k => D.PACK_ORDER.includes(k)))
      && [5, 10, 15, 20, 25, 30].filter(n => (D.ladderPay(n).first || {}).prem).length >= 3;
    const epic = Array.from({length: 40}, (_, i) => D.drawPack('prem', {R: D.rng('e' + i)})).every(ids => ids.every(id => ['epic', 'legendary', 'mythic'].includes(D.anyCard(id).r)));
    const key = id => (D.card(id) && D.card(id).p) || id;
    let dupes = 0;
    ['std', 'team', 'prem', 'start'].forEach(k => ['KC', 'BUF', 'JAX', 'ARI'].forEach(t => { for (let i = 0; i < 60; i++) { const ids = D.drawPack(k, {team: t, R: D.rng(`u|${k}|${t}|${i}`)}); if (new Set(ids).size !== ids.length || new Set(ids.map(key)).size !== ids.length) dupes++; } }));
    return {pass: three && fewer && held && shut && rewards && epic && !dupes, detail: `packs ${D.PACK_ORDER.join(', ')}; Team ${size('team')} cards, Standard ${size('std')}; held ${JSON.stringify(c.pk)}; retired shut ${shut}; rewards ${rewards}; Epic ${epic}; packs with a repeat ${dupes}`};
  });
  check('Gridiron Dynasty: every pack’s odds add up to 100% and a pack draws its count of real cards (a Team Pack only that team’s)', () => {
    const sums = D.PACK_ORDER.every(k => D.packOdds(k).every(g => Math.abs(g.odds.reduce((t, o) => t + o.pct, 0) - 100) < 0.6));
    const counts = D.PACK_ORDER.every(k => { const n = D.PACKS[k].slots.reduce((t, s) => t + s.n, 0); const ids = D.drawPack(k, {team: 'BUF', R: D.rng('pack|' + k)}); return ids.length === n && ids.every(D.isCard); });
    const team = D.drawPack('team', {team: 'KC', R: D.rng('t')}).every(id => D.card(id) && D.card(id).team === 'KC' && D.card(id).s !== 'X');
    const trainerSlot = D.drawPack('std', {R: D.rng('s')}).filter(id => D.trainer(id)).length === 1;
    const prem = D.drawPack('prem', {R: D.rng('p')}).slice(-1).every(id => ['legendary', 'mythic'].includes(D.card(id).r));
    return {pass: sums && counts && team && prem && trainerSlot, detail: 'odds, counts, team, the Epic Pack’s last card, a Coach or Stadium card a Standard Pack'};
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
  check('Gridiron Dynasty: a save is cleaned (only real packs, a deck of 20 at most), another season’s or a broken one refused; a new one starts with the starter Coach cards and Items, welcome packs and a Starter Pack (never sold)', () => {
    const f = D.fresh('m_check', 1000);
    const c = D.clean({...f, pk: {std: 2, start: 1, bogus: 4}, dk: [...D.TRAINER_IDS, ...D.TRAINER_IDS], o: {...f.o, X: -3}, bt: {x: 'w', y: 'nope'}});
    const refused = D.clean({...f, rs: 'old'}) === null && D.clean(null) === null && D.clean('x') === null;
    const kit = f.o['C-timeout'] === 2 && f.o['I-recruit'] === 2 && !Object.keys(f.o).some(D.card) && f.kit3 === 1 && c.kit3 === 1;
    const packs = f.pk.start === 1 && f.pk.std === 2 && f.pk.prem === 1 && !D.PACK_ORDER.includes('start') && !D.buy('start', f).ok && f.pk.start === 1;
    return {pass: kit && packs && !c.pk.bogus && c.pk.std === 2 && c.pk.start === 1 && c.dk.length === B.DECK_SIZE && !('X' in c.o) && c.bt.x === 'w' && !c.bt.y && refused,
      detail: `kit ${kit}, packs ${packs}`};
  });
  check('Gridiron Dynasty: the Starter Pack (the owner, Oct 29 2026: "15 common players 4 rare players and one epic or better player"; Rare retired Nov 2 2026) gives twenty different active players, 15 Common, 4 Epic and one Epic or better, and opening it makes a legal 20-card deck', () => {
    const P = D.PACKS.start, ids = D.drawPack('start', {R: D.rng('starter-check')}), cs = ids.map(D.card);
    const by = r => cs.filter(c => c && c.r === r).length;
    const shape = ids.length === 20 && cs.every(c => c && c.s !== 'X') && new Set(cs.map(c => c.p)).size === 20
      && by('common') === 15 && cs.slice(15, 19).every(c => c.r === 'epic') && ['epic', 'legendary', 'mythic'].includes(cs[19].r);
    const odds = D.packOdds('start').every(g => Math.abs(g.odds.reduce((t, o) => t + o.pct, 0) - 100) < 0.6);
    const s = D.fresh('m_start', 1000), r = D.open('start', {}, s), deck = B.checkDeck(s.dk, s.o);
    const opened = r.ok && r.cards.length === 20 && !s.pk.start && deck.ok && s.dk.some(id => D.trainer(id)) && !D.open('start', {}, s).ok;
    return {pass: P.price === 0 && P.starter && shape && odds && opened, detail: `${by('common')} Common, ${cs.slice(15, 19).filter(c => c.r === 'epic').length} Epic, last ${cs[19] && cs[19].r}; deck ${deck.ok ? 'legal' : deck.why}`};
  });
  check('Gridiron Dynasty battles: a deck is 20 cards, at most 2 of any player (an old Live and Gameday card of him count together) or card, with a Basic player; the best deck built from a collection is legal', () => {
    const f = started('m_deck'), ok = B.checkDeck(f.dk).ok;
    const short = !B.checkDeck(f.dk.slice(1)).ok;
    const [gid] = [...D.ALIAS].find(([o]) => D.card(o).s === 'L') || [], l = D.card(gid), g = l && D.card(D.ALIAS.get(gid));
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
    // (one card a player, rules v5: every card a Basic; a Gameday or Prime card was an upgrade in a v1-v4 battle)
    const evo = D.CARDS.filter(c => c.s === 'G' || c.s === 'P').every(c => B.stageOf(c.id, 4) === 1 && B.stageOf(c.id) === 0) && D.CARDS.every(c => B.isBasic(c.id));
    return {pass: all && weak && ex && evo, detail: `${D.CARDS.length} battle cards`};
  });
  check('Gridiron Dynasty battles: a game played out from both decks and moves is the same game when replayed (every phone sees the same), and it ends with a winner by three touchdowns', () => {
    const d0 = started('m_a').dk, d1 = started('m_b').dk, seed = 'bcheck1';
    const G = B.newGame(seed, [d0, d1], B.RULES_VERSION), log = [[], []], cur = [[], []];
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
    const R = B.replay(seed, [d0, d1], log, B.RULES_VERSION);
    const same = !R.bad && R.G.phase === 'over' && JSON.stringify(R.G.p.map(p => p.pts)) === JSON.stringify(G.p.map(p => p.pts)) && R.G.over.win === G.over.win;
    return {pass: G.phase === 'over' && same && (G.over.why === 'points' || G.over.why === 'empty'), detail: `${G.turn} turns, ${G.p[0].pts}–${G.p[1].pts}, ${G.over.why}`};
  });
  check('Gridiron Dynasty plays as Pokémon TCG Pocket (the owner, Oct 28 2026: "I want the gameplay and theme/design to match the Pokémon app"): the Energy Zone shows the next energy and it is the one that comes; Items (Recruit, Water Bottle) play as many as you like in a turn, only in a new battle; starter decks carry them; a pack gives 5 pack points, traded for a card', () => {
    const d0 = started('m_a').dk, d1 = started('m_b').dk;
    const kit = ['I-recruit', 'I-water'].every(id => d0.includes(id));
    const G = B.newGame('pocket1', [d0, d1], 2);
    for (let i = 0; i < 2; i++) { const who = B.toMove(G), h = G.p[who].hand.filter(B.isBasic); B.play(G, who, {a: 'setup', act: h[0], bench: []}); }
    let zone = true;
    for (let t = 0; t < 6 && G.phase !== 'over'; t++) {
      const who = B.toMove(G), next = G.p[who].next;
      B.play(G, who, {a: 'end'}); B.play(G, B.toMove(G), {a: 'end'});
      zone = zone && !!next && G.p[who].en === next;
    }
    const who = B.toMove(G), me = G.p[who];
    me.active.dmg = 30; me.hand.push('I-water', 'I-recruit');
    const hand = me.hand.length, basics = me.deck.filter(B.isBasic).length;
    const w = B.play(G, who, {a: 'item', id: 'I-water', on: me.active.u}).ok, r = B.play(G, who, {a: 'item', id: 'I-recruit'}).ok;
    const items = w && r && me.active.dmg === 10 && me.hand.length === hand - 2 + (basics ? 1 : 0);
    const V1 = B.newGame('pocket1', [d0, d1]);
    const old = !B.check(V1, 0, {a: 'item', id: 'I-recruit'}).ok;
    const s = D.fresh('m_pp', 1000), pp = s.pp, opened = D.open('std', {}, s).ok && s.pp === pp + D.PP_PER_PACK;
    const want = D.CARDS.find(c => D.ppCost(c) === 35 && !(s.o[c.id] > 0));
    s.pp = 40; const traded = D.exchange(want.id, s).ok && s.o[want.id] === 1 && s.pp === 5 && !D.exchange(want.id, s).ok;
    return {pass: kit && zone && items && old && opened && traded, detail: `kit ${kit}, zone ${zone}, items ${items}, v1 without ${old}, pack points ${opened && traded}`};
  });
  check('Gridiron Rivals Solo ladder (the owner, Oct 30 2026: "games against the cpu getting increasingly difficult … around 15-20 games in there is a noticeable difference"): thirty games, each deck legal for every main type, weak to yours early and countering it from game 16; the computer only makes legal moves and finishes battles at every tier; each game unlocks the next; a win pays coins (double the first time, every fifth game packs too), once; the earlier opponents still play', async () => {
    const S = await import('./dynasty-solo.js');
    const types = ['A', 'G', 'B', 'C'];
    const legal = S.STAGES.length === 30 && S.STAGES.every(g => types.every(t => B.checkDeck(S.deckFor(g.id, t)).ok)) && S.OPPONENTS.every(o => B.checkDeck(S.deckFor(o.id)).ok);
    const main = (id, t) => B.deckTypes(S.deckFor(id, t)).map(e => B.ENERGY_TYPE[e]);
    const shaped = types.every(t => !main('g1', t).includes(B.WEAK[t]) && main('g16', t).includes(B.WEAK[t]));
    const ovr = id => { const p = S.deckFor(id, 'A').map(D.card).filter(Boolean); return p.reduce((a, c) => a + c.o, 0) / p.length; };
    const climbs = ovr('g1') < ovr('g10') && ovr('g10') < ovr('g16') && ovr('g16') < ovr('g26');
    const games = [];
    for (const [a, b] of [['g1', 'g3'], ['g12', 'g16'], ['g22', 'g30'], ['the-dynasty', 'g8']]) {
      const A = S.opponent(a), Bo = S.opponent(b), G = B.newGame('solo-check|' + a + b, [S.deckFor(a, 'A'), S.deckFor(b, 'B')], 4);
      let bad = null, n = 0;
      while (G.phase !== 'over' && n < 3000 && !bad) {
        const who = B.toMove(G), m = S.nextMove(G, who, who === 0 ? A.lv : Bo.lv);
        if (!B.play(G, who, m).ok) bad = m; n++;
      }
      games.push({ok: !bad && G.phase === 'over', t: `${A.name} ${G.p[0].pts}–${G.p[1].pts} ${Bo.name} (${G.over ? G.over.why : 'unfinished'})`});
    }
    const s = D.fresh('m_solo', 1000), cr = s.cr, std = s.pk.std || 0;
    const lock = S.ladderAt(s) === 1 && S.unlocked('g1', s) && !S.unlocked('g2', s);
    const w1 = D.paySolo('cpu1', 'g5', 5, 'w', s), again = D.paySolo('cpu1', 'g5', 5, 'w', s), w2 = D.paySolo('cpu2', 'g5', 5, 'w', s), l = D.paySolo('cpu3', 'g5', 5, 'l', s);
    const pay = w1 && w1.first && w1.coins === 2 * D.ladderPay(5).coins && !again && w2 && !w2.first && !w2.packs && w2.coins === D.ladderPay(5).coins && l && l.coins === 0
      && s.cr === cr + 3 * D.ladderPay(5).coins && s.pk.std === std + 1 && s.so.g5 === 2 && s.tr === 0 && s.rec.w === 0;
    s.so.g1 = 1; s.so.g2 = 1;
    const next = S.ladderAt(s) === 3 && S.unlocked('g3', s) && !S.unlocked('g4', s) && S.unlocked('g5', s);
    const old = D.paySolo('cpu4', 'prime-time', 'exp', 'w', s);
    const kept = JSON.stringify(D.clean(s).so) === JSON.stringify(s.so) && D.clean(s).sl.length === 4 && old && old.coins === D.SOLO_PAY.exp.coins;
    return {pass: legal && shaped && climbs && games.every(g => g.ok) && lock && pay && next && kept,
      detail: `decks ${legal}, types ${shaped}, OVR ${[1, 10, 16, 26].map(n => Math.round(ovr('g' + n))).join('→')}; ${games.map(g => g.t).join('; ')}; lock ${lock}, pay ${pay}, next ${next}, kept ${kept}`};
  });
  check('Gridiron Dynasty: unlimited packs for Evan and Ryan Stewart (his ask, Oct 29 2026: "Give Ryan Stewart and I unlimited packs to open"): by their ids, any pack opens without buying or holding one, a held one used first (the Starter Pack stays one); anyone else still needs one', async () => {
    const F = await import('./features.js');
    const keys = ['m_evan', 'u_ryan-stewart', 'm_mason', 'u_ryan-dow', 'g_72_79'].map(F.packsUnlimited);
    const s = D.fresh('m_inf', 1000), o = Object.values(s.o).reduce((t, n) => t + n, 0);
    const held = D.open('std', {free: true}, s).ok && s.pk.std === 1;
    const none = D.open('prem', {free: true}, s).ok && D.open('prem', {free: true}, s).ok && !s.pk.prem && s.sp === 0;
    const got = Object.values(s.o).reduce((t, n) => t + n, 0) - o === 5 + 5 + 5;
    const others = !D.open('prem', {free: false}, s).ok;
    const starter = D.open('start', {free: true}, s).ok && !D.open('start', {free: true}, s).ok;
    return {pass: keys.join() === 'true,true,false,false,false' && held && none && got && others && starter, detail: `Evan, Ryan S, Mason, Ryan D, a guest: ${keys.join(', ')}`};
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
  check('Gridiron Dynasty: every collection pays packs, and a set claimed before the bonus gets it once', () => {
    const noPacks = D.COLLECTIONS.filter(c => !Object.values(c.reward.packs || {}).some(n => n > 0) || !Object.keys(c.bonus || {}).length);
    const team = D.COLLECTIONS.find(c => c.kind === 'team'), s = D.fresh('m_check');
    s.cl[team.id] = 1; s.pk = {};
    const got = D.topUp(s);
    return {pass: !noPacks.length && team.reward.packs.std === 2 && team.reward.packs.prem === 1 && s.pk.std === 2 && got.std === 2 && D.fresh('x').kit4 === 1,
      detail: noPacks.map(c => c.id).join(', ') || team.name};
  });
  check('Gridiron Dynasty: the board, who you can challenge and the other side of a battle follow the scoreboards’ rule (everyone, read from daily.LB.raw)', async () => {
    const [src, msrc] = await Promise.all(['./dynasty.js', './dynasty-match.js'].map(f => fetch(new URL(f, import.meta.url)).then(r => r.text())));
    const raw = src.includes('export function others(docs = daily.LB.raw || []') && msrc.includes('for (const p of daily.LB.raw || [])');
    // (LB.all only in allDocs: finding your own saved copy, as Keepfall does)
    const all = (src.match(/daily\.LB\.all/g) || []).length === 1 && (msrc.match(/daily\.LB\.all/g) || []).length === 1;
    return {pass: raw && all, detail: 'others() and the matches from LB.raw; LB.all only for your own saves'};
  });
  check('Gridiron Rivals: the title screen retains its logo, drifting cards, Tap to Start and support id; four labeled tabs open Play first, with Menu in the header and direct match, deck, solo and friend routes', async () => {
    const V = await import('../views/dynasty.js');
    const shell = V.shellHTML(), start = V.startHTML();
    const root = document.createElement('div'); root.innerHTML = shell;
    const tabs = root.querySelectorAll('.pk-tab').length;
    const menu = !!root.querySelector('.pk-hdr [data-dy-menu]') && !!root.querySelector('[data-dy-hud]');
    const nav = [...root.querySelectorAll('.pk-tab .rh-tab-label')].map(n => n.textContent).join('|') === 'Play|Cards|Decks|Packs'
      && root.querySelector('.pk-tab.is-on')?.dataset.dyTab === 'battle';
    const logo = /pk-logo-top">Gridiron<\/span>/.test(start) && /Trading Card Game/.test(start) && /pk-logo-sub">Rivals<\/span>/.test(start);
    const bits = /data-dy-start/.test(start) && /role="button"/.test(start) && /Support ID: [A-Z0-9]{8}</.test(start) && /Ver\. 3\.0\.\d+</.test(start) && /data-dy-menu/.test(start) && /data-dy-exit/.test(start);
    const say = D.status === 'ready' ? /Tap to Start/.test(start) : /Loading/.test(start);
    const drawn = (start.match(/pk-start-card/g) || []).length; // no cards on the title screen (the owner, Nov 2 2026)
    // (the support id: the same for a profile every time, another's another, never the profile's key)
    const ids = [V.supportId('m_evan'), V.supportId('m_evan'), V.supportId('u_ryan-stewart')];
    const battle = V.battleHome({pack: 'std'}, D.fresh('m_check'));
    const modes = ['class="rh-hero"', 'class="rh-play"', 'class="rh-active-deck" data-dy-tab="decks"', 'data-dy-bv="versus"', 'data-dy-bv="solo"', 'data-dy-guide', 'data-dy-bv="rank"', 'Collections'].every(x => battle.includes(x));
    return {pass: tabs === 4 && nav && menu && logo && bits && say && drawn === 0 && !('startCards' in V) && ids[0] === ids[1] && ids[0] !== ids[2] && !/EVAN/.test(ids[0]) && modes,
      detail: `${tabs} tabs; no cards on the title screen; support id ${ids[0]}`};
  });
  check('Gridiron Dynasty: each rarity’s reveal on the deal grows with it (the owner, Oct 29 2026: "The more rare the player, the more exciting the animation"): ◆ dealt face up, ◆◆ flips, ◆◆◆ a ring, sparks and its stamp, ◆◆◆◆ rays, a flash and confetti, ★ and ★★ the drum and the sweep, ♛ the crown and the most of everything', async () => {
    const O = await import('../views/dynasty-open.js');
    const pick = f => D.CARDS.find(f);
    // (one card a player, Nov 2 2026: a player card's mark is its rarity's, ♛ a Legend's; ◆◆ and ★★ are no player card's now)
    const cards = [pick(c => c.r === 'common' && c.s === 'L'), pick(c => c.r === 'epic' && c.s === 'L'), pick(c => c.r === 'legendary' && c.s === 'L'),
      pick(c => c.r === 'mythic' && c.s !== 'X'), pick(c => c.s === 'X')];
    const R = cards.map(O.revealOf);
    const tiers = R.map(r => r.tier).join() === '0,2,3,4,6' && D.CARDS.every(c => [0, 2, 3, 4, 6].includes(O.revealOf(c).tier));
    const up = k => R.every((r, i) => !i || r[k] >= R[i - 1][k]);
    // (and each tier a clear step past the last in at least one of them: never two the same)
    const step = R.every((r, i) => !i || ['hold', 'total', 'sparks', 'confetti'].some(k => r[k] > R[i - 1][k]));
    const more = up('hold') && up('flip') && up('sparks') && up('confetti') && up('total') && step && R.every((r, i) => !i || r.haptics.length >= R[i - 1].haptics.length) && R[4].total > R[0].total * 4;
    const labels = R.map(r => r.label).join() === ',Epic,Legendary,Mythic,Legend';
    // (a Trainer card by its rarity: an Epic one tier 2, a Legendary one tier 3, stamped so; the rarest dealt last)
    const tr = D.TRAINER_IDS.map(D.trainer), te = tr.find(t => t.r === 'epic'), tl = tr.find(t => t.r === 'legendary');
    const trainers = !!te && !!tl && O.revealOf(te).tier === 2 && O.revealOf(te).label === 'Epic' && O.revealOf(tl).tier === 3 && O.revealOf(tl).label === 'Legendary';
    const dealt = O.dealOrder([cards[4], cards[0], tl, cards[3], cards[1], te, cards[2]]).map(O.revealOf).map(r => r.tier);
    const order = dealt.every((t, i) => !i || t >= dealt[i - 1]) && dealt[0] === 0 && dealt[6] === 6;
    const html = O.dealHTML(cards[4], R[4], '<div class="pk-card"></div>', true);
    const crown = /class="pk-deal-c t-6 is-flip is-shake"/.test(html) && /pk-fx-crown/.test(html) && /pk-fx-rays/.test(html) && /pk-fx-flash/.test(html) && /pk-fx-sweep/.test(html)
      && (html.match(/class="pk-spk"/g) || []).length === 22 && /pk-deal-tag">Legend</.test(html) && /pk-flip-back/.test(html) && /NEW/.test(html);
    const plain = O.dealHTML(cards[0], R[0], '<div class="pk-card"></div>', false);
    const common = /class="pk-deal-c t-0 is-face"/.test(plain) && !/pk-spk|pk-fx-|pk-deal-tag|NEW/.test(plain);
    const epic = O.dealHTML(cards[1], R[1], '', false);
    const mid = /t-2 is-flip"/.test(epic) && /pk-fx-ring/.test(epic) && !/pk-fx-rays|pk-fx-flash|pk-fx-sweep|pk-fx-crown/.test(epic) && /pk-deal-tag">Epic</.test(epic);
    return {pass: tiers && more && labels && trainers && order && crown && common && mid,
      detail: `tiers ${R.map(r => r.tier).join(' < ')}; ${R.map(r => `${r.name} ${r.total}ms`).join(', ')}`};
  });
  check('Gridiron Dynasty: every pack comes in several art designs, more detailed the rarer the pack (the owner, Oct 29 2026: "Add more art designs to the packs. The more rare the pack, the more detailed the art design should be"): at least three each, the average and the plainest design of each tier above the tier below, each within its budget, no SVG filters below Gameday, ids a pack’s own (two on a page share none), a stored design past the end wrapped', async () => {
    const P = await import('../views/dynasty-packs.js');
    const BUDGET = {1: 30, 2: 55, 3: 90, 4: 150, 5: 240}, kinds = Object.keys(D.PACKS), by = {};
    let ok = true, why = '';
    const svgOf = html => { const host = document.createElement('div'); host.innerHTML = html; return host.querySelector('.pk-pack-art svg'); };
    for (const k of kinds) {
      const ds = P.designsOf(k), t = P.TIER[k];
      if (ds.length < 3 || new Set(ds.map(d => d.id)).size !== ds.length) { ok = false; why += `${k}: ${ds.length} designs; `; }
      ds.forEach((d, i) => {
        const html = P.packHTML(k, {big: true, design: i}), svg = svgOf(html), n = svg.querySelectorAll('*').length;
        // (a design that threw is drawn by the pack's first, marked data-art-fallback: that's a broken design)
        if (!html.includes(`data-art="${d.id}"`) || /data-art-fallback=/.test(html)) { ok = false; why += `${d.id} fell back; `; }
        const ids = [...svg.querySelectorAll('[id]')].map(e => e.id), u = ids.length ? ids[0].slice(0, ids[0].indexOf('_') + 1) : '';
        if (n > BUDGET[t] || (t < 4 && svg.querySelector('filter')) || !ids.every(id => id.startsWith(u)) || n < 8) { ok = false; why += `${d.id} (${n}); `; }
        (by[t] = by[t] || []).push(n);
      });
    }
    const mean = t => by[t].reduce((a, b) => a + b, 0) / by[t].length;
    const rises = [2, 3, 4, 5].every(t => mean(t) > mean(t - 1) && Math.min(...by[t]) > mean(t - 1));
    const a = svgOf(P.packHTML('leg', {big: true})), b = svgOf(P.packHTML('leg', {big: true}));
    const own = ![...a.querySelectorAll('[id]')].some(e => b.querySelector(`[id="${e.id}"]`));
    const n = P.designsOf('gday').length, wrap = /data-art="([^"]+)"/.exec(P.packHTML('gday', {design: n + 1}))[1] === P.designsOf('gday')[1].id;
    return {pass: ok && rises && own && wrap, detail: `${why}average elements by tier ${[1, 2, 3, 4, 5].map(t => Math.round(mean(t))).join(' < ')}; ids ${own ? 'its own' : 'shared'}; wrap ${wrap}`};
  });
  check('Gridiron Rivals: collectible cards share a clear portrait, name, OVR and rarity layout; a card up close shows the player\u2019s page, not his real cards (the owner, Nov 2 2026: "Remove the real cards section"); collection identity, rarity and namesake matching are preserved', async () => {
    const [V, R, S] = await Promise.all([import('../views/dynasty.js'), import('./dynasty-real.js'), import('../views/dynasty-stats.js')]);
    const keys = Object.keys(R.REAL), cards = D.CARDS.filter(c => R.REAL[c.p]);
    const known = keys.length >= 16 && keys.every(p => D.DATA.players[p] && D.CARDS.some(c => c.p === p) && R.REAL[p].length
      && R.REAL[p].every(r => /^[0-9a-f]{8}$/.test(r[0]) && r[1] >= 1990 && r[2] && r[4]));
    const shows = cards.every(c => {
      const h = V.cardHTML(c);
      const el = document.createElement('div'); el.innerHTML = h;
      const portrait = c.head && !/^https?:/.test(c.head);
      return !!c.real && R.REAL[c.p].includes(c.real) && D.markOf(c).full === (c.r !== 'common') && /class="pk-card [^"]*is-full r-/.test(h) === (c.r !== 'common')
        && el.querySelector('.pk-c-name')?.textContent === c.name && el.querySelector('.pk-c-ovr b')?.textContent === String(c.o)
        && el.querySelector('.pk-c-rar')?.textContent === c.r && !el.querySelector('.pk-c-ph.is-real')
        && (portrait ? el.querySelector('.pk-c-ph')?.getAttribute('src') === V.headUrl(c.head) : !!el.querySelector('.pk-c-num'))
        && !S.pageHTML(c).includes(R.realUrl(c.p, c.real));
    });
    const commons = D.CARDS.filter(c => c.r === 'common'), framed = commons.length > 0 && commons.every(c => c.s === 'X' || (!D.markOf(c).full && D.markOf(c).mark === '◆'))
      && commons.filter(c => c.head).slice(0, 50).every(c => { const h = V.cardHTML(c); return !/is-real|is-full/.test(h) && h.includes(V.isPhoto(c.head) ? 'class="pk-c-ph is-photo" src=' : V.isAction(c.head) ? 'class="pk-c-ph is-action" src=' : 'class="pk-c-ph" src='); });
    // (the foil: the rarity's class on the card, which css/views/dynasty.css animates from Epic up)
    const foil = D.RARITY.every(r => { const c = D.CARDS.find(x => x.r === r); return c && V.cardHTML(c).includes(` r-${r} `); });
    const allen = [...D.BY_ID.values()].filter(c => c.p === '0034857').map(c => c.real), apart = allen.length >= 3 && new Set(allen).size === allen.length;
    const up = S.pageHTML(D.card('Xtombrady')), close = !/real cards|On this card|<figure/.test(up) && typeof V.realHTML === 'undefined';
    const lb = D.CARDS.filter(c => c.name === 'Justin Jefferson' && c.pos === 'LB'), namesake = lb.length > 0 && lb.every(c => !c.real && c.r === 'common');
    const urls = keys.flatMap(p => R.REAL[p].map(r => R.realUrl(p, r)));
    const got = await Promise.all(urls.map(u => fetch(u, {method: 'HEAD', cache: 'no-store'}).then(r => r.ok).catch(() => false)));
    return {pass: known && shows && framed && foil && apart && close && namesake && got.every(Boolean),
      detail: `${urls.length} pictures for ${keys.length} players on ${cards.length} cards, ${commons.length} Common; Josh Allen’s ${allen.map(R.realName).join(', ')}; missing ${urls.filter((u, i) => !got[i]).join(', ') || 'none'}`};
  });
  check('Gridiron Rivals: a card up close is the player\u2019s page, after MLB The Show\u2019s (the owner, Nov 2 2026: "Expand on the players stats. Take inspiration from the attached mlb the show stats page"): position, number and name in his team\u2019s colours, his bio, the card\u2019s attributes as bars on 0-99, his ranks at his position, this season\u2019s and last season\u2019s tables and his last games', async () => {
    const S = await import('../views/dynasty-stats.js');
    const d = await S.loadStats();
    const live = D.CARDS.filter(c => c.s !== 'X'), bad = [];
    live.forEach(c => {
      const p = d.p[c.p], cols = d.cols[d.group[c.pos]];
      if (!p || !cols) { bad.push(c.name + ' none'); return; }
      if (![p[1], p[2]].every(r => r === 0 || r.length === cols.length)) bad.push(c.name + ' table');
      if (p[3].some(g => g.length !== cols.length + 2)) bad.push(c.name + ' log');
    });
    const withBio = live.filter(c => d.p[c.p] && d.p[c.p][0][0] > 0).length;
    const puka = D.CARDS.find(c => c.p === '0039075');
    const el = document.createElement('div');
    el.innerHTML = S.pageHTML(puka);
    const bars = [...el.querySelectorAll('.pk-ps-col')].map(x => +x.querySelector('em').textContent);
    const page = el.querySelector('.pk-ps-num')?.textContent === String(puka.num) && el.querySelector('.pk-ps-name b')?.textContent === 'Nacua'
      && bars.join() === puka.a.join() && /Height/.test(el.textContent) && el.querySelectorAll('.pk-ps-ranks li').length > 0
      && el.querySelectorAll('[data-seg="dy-ps"] button').length === 3;
    el.innerHTML = S.pageHTML(puka, 'stats');
    const table = el.querySelectorAll('.pk-ps-t tbody tr').length === 2 && el.querySelector('.pk-ps-t thead').textContent.includes('YDS');
    el.innerHTML = S.pageHTML(puka, 'games');
    const games = el.querySelectorAll('.pk-ps-t tbody tr').length >= 1 && /Wk \d+ (vs|@) /.test(el.textContent);
    el.innerHTML = S.pageHTML(D.card('Xtombrady'), 'stats');
    const legend = el.querySelectorAll('[data-seg="dy-ps"] button').length === 2 && /2000\u201322/.test(el.textContent);
    return {pass: !bad.length && withBio > live.length * 0.95 && page && table && games && legend,
      detail: `${live.length} players, ${withBio} with a bio; ${bad.slice(0, 5).join(', ') || 'no faults'}; page ${page}, table ${table}, games ${games}, legend ${legend}`};
  });
  check('Gridiron Rivals: no Legend wears a headshot (the owner, Oct 31 2026: "Remove any headshot of the legend players"): every Legend card wears his action photo, cut out, or else shows his number; no card wears a lead photo or portrait; a Common Live card keeps its cut-out headshot', async () => {
    const [V, A] = await Promise.all([import('../views/dynasty.js'), import('./dynasty-action.js')]);
    const legends = D.CARDS.filter(c => c.s === 'X');
    const wrong = legends.filter(c => {
      const el = document.createElement('div'); el.innerHTML = V.cardHTML(c);
      const img = el.querySelector('.pk-c-ph');
      return A.ACTION[c.p] ? !(c.head === 'a:' + c.p && img?.classList.contains('is-action') && img.getAttribute('src') === A.actionUrl(c.p))
        : !(!c.head && !img && !!el.querySelector('.pk-c-num'));
    });
    const portraits = D.CARDS.filter(c => /^w:/.test(String(c.head)) || V.cardHTML(c).includes('is-photo'));
    const live = D.CARDS.find(c => c.s === 'L' && c.head && c.r === 'common'), cut = !!live && !V.isPhoto(live.head) && !V.isAction(live.head);
    return {pass: legends.length > 100 && !wrong.length && !portraits.length && cut,
      detail: `${legends.length} Legend cards, ${legends.filter(c => A.ACTION[c.p]).length} with an action photo${wrong.length ? `; wrong: ${wrong.map(c => c.name).join(', ')}` : ''}; showing his number: ${[...new Set(legends.filter(c => !A.ACTION[c.p]).map(c => c.name))].join(', ') || 'none'}${portraits.length ? `; portraits on ${portraits.map(c => c.name).join(', ')}` : ''}`};
  });
  check('Gridiron Rivals: action photos (the owner, Oct 31 2026: "There should be a clean cutout of the player in game ... All cards aside from the common \u201cbasic\u201d cards should have an action photo of them in their playing days"): every Rare, Epic, Legendary or Mythic card of a player with one, and every Legend card, wears it cut out over its team\u2019s colours; up close it names the trading card the photo is from, or credits the Commons photo (author, licence, page); every Common card but a Legend\u2019s keeps its headshot; every photo loads', async () => {
    const [V, A, R, data] = await Promise.all([import('../views/dynasty.js'), import('./dynasty-action.js'), import('./dynasty-real.js'), import('./data.js')]);
    const keys = Object.keys(A.ACTION);
    // (one card a player, Nov 2 2026: a player under 80 is Common, so he keeps his headshot though he has a photo)
    const known = keys.length >= 150 && keys.every(p => D.DATA.players[p] && A.ACTION[p].length === 6 && A.actionCredit(p) && D.CARDS.some(c => c.p === p));
    const wears = c => A.ACTION[c.p] && (c.r !== 'common' || c.s === 'X');
    const rare = D.CARDS.filter(c => c.r !== 'common'), wearing = D.CARDS.filter(wears), common = D.CARDS.filter(c => c.r === 'common' && c.s !== 'X');
    const shows = wearing.length > 0 && wearing.every(c => {
      const el = document.createElement('div'); el.innerHTML = V.cardHTML(c);
      const img = el.querySelector('.pk-c-ph'), cr = V.creditHTML(c), r = A.actionCredit(c.p), T = D.teamOf(c.team);
      const credited = r.card ? cr.includes(data.esc(R.realName(r.card))) : cr.includes(data.esc(r.page)) && cr.includes(data.esc(r.author)) && cr.includes(data.esc(r.licence));
      return c.head === 'a:' + c.p && img?.classList.contains('is-action') && !img.classList.contains('is-photo') && img.getAttribute('src') === A.actionUrl(c.p)
        && /\.webp$/.test(A.actionUrl(c.p)) && el.firstElementChild.style.getPropertyValue('--tp') === T.pri && credited;
    });
    const kept = common.every(c => c.head === (D.DATA.players[c.p][4] || '') && !V.cardHTML(c).includes('is-action'));
    const fromCards = keys.filter(p => A.ACTION[p][1].startsWith('card:')).length;
    const without = [...new Set(rare.filter(c => !A.ACTION[c.p]).map(c => c.name))];
    const urls = keys.map(A.actionUrl);
    const got = await Promise.all(urls.map(u => fetch(u, {method: 'HEAD', cache: 'no-store'}).then(r => r.ok).catch(() => false)));
    return {pass: known && shows && kept && got.every(Boolean),
      detail: `${keys.length} players (${fromCards} from their trading cards) on ${wearing.length} cards; ${common.length} Common cards keep their headshot; Rare+ without one: ${without.join(', ') || 'none'}; missing ${urls.filter((u, i) => !got[i]).join(', ') || 'none'}`};
  });
}
