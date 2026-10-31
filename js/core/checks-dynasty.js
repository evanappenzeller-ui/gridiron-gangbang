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
  check('Gridiron Dynasty: the cards: real players in six series, every position, rarity on the real cards’ scale (the owner, Oct 29 2026: "use the new cards for the rare and above. create a new player ranking scale using this"): a card with a real trading card Mythic 95+, Legendary 91+, Epic 87+, else Rare; every other card Common; every Live rarity has cards to draw', () => {
    const series = new Set(D.CARDS.map(c => c.s)), pos = new Set(D.CARDS.filter(c => c.s === 'L').map(c => c.pos));
    const rar = D.CARDS.every(c => c.r === D.rarityOf(c.o, !!c.real) && (c.r === 'common') === !c.real && c.o >= 40 && c.o <= 99);
    const live = D.RARITY.map(r => D.CARDS.filter(c => c.s === 'L' && c.r === r).length), drawable = live.every(n => n > 0);
    const ids = new Set(D.CARDS.map(c => c.id)).size === D.CARDS.length;
    const ok = ['L', 'R', 'P', 'G', 'A', 'X'].every(s => series.has(s)) && ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'].every(p => pos.has(p));
    const tr = D.TRAINER_IDS.length >= 10 && D.TRAINER_IDS.every(id => D.trainer(id).name && ['epic', 'legendary'].includes(D.trainer(id).r));
    const names = D.RARITY.join() === 'common,rare,epic,legendary,mythic' && [99, 86, 87, 91, 95].map((o, i) => D.rarityOf(o, i > 0)).join() === D.RARITY.join();
    return {pass: ok && rar && ids && tr && names && drawable,
      detail: `${D.CARDS.length} cards, ${pos.size} positions, ${D.TRAINER_IDS.length} Coach and Stadium cards; Live ${D.RARITY.map((r, i) => `${r} ${live[i]}`).join(', ')}`};
  });
  check('Gridiron Dynasty: every pack’s odds add up to 100% and a pack draws its count of real cards (a Team Pack only that team’s, a Gameday Pack a Gameday card)', () => {
    const sums = D.PACK_ORDER.every(k => D.packOdds(k).every(g => Math.abs(g.odds.reduce((t, o) => t + o.pct, 0) - 100) < 0.6));
    const counts = D.PACK_ORDER.every(k => { const n = D.PACKS[k].slots.reduce((t, s) => t + s.n, 0); const ids = D.drawPack(k, {team: 'BUF', R: D.rng('pack|' + k)}); return ids.length === n && ids.every(D.isCard); });
    const team = D.drawPack('team', {team: 'KC', R: D.rng('t')}).every(id => D.trainer(id) || (D.card(id).team === 'KC' && D.card(id).s === 'L'));
    const trainerSlot = D.drawPack('std', {R: D.rng('s')}).filter(id => D.trainer(id)).length === 1;
    const gd = D.card(D.drawPack('gday', {R: D.rng('g')})[0]).s === 'G';
    const prem = D.drawPack('prem', {R: D.rng('p')}).slice(-1).every(id => ['legendary', 'mythic'].includes(D.card(id).r));
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
  check('Gridiron Dynasty: a save is cleaned (only real packs, a deck of 20 at most), another season’s or a broken one refused; a new one starts with the starter Coach cards and Items, welcome packs and a Starter Pack (never sold)', () => {
    const f = D.fresh('m_check', 1000);
    const c = D.clean({...f, pk: {std: 2, start: 1, bogus: 4}, dk: [...D.TRAINER_IDS, ...D.TRAINER_IDS], o: {...f.o, X: -3}, bt: {x: 'w', y: 'nope'}});
    const refused = D.clean({...f, rs: 'old'}) === null && D.clean(null) === null && D.clean('x') === null;
    const kit = f.o['C-timeout'] === 2 && f.o['I-recruit'] === 2 && !Object.keys(f.o).some(D.card) && f.kit3 === 1 && c.kit3 === 1;
    const packs = f.pk.start === 1 && f.pk.std === 2 && f.pk.prem === 1 && !D.PACK_ORDER.includes('start') && !D.buy('start', f).ok && f.pk.start === 1;
    return {pass: kit && packs && !c.pk.bogus && c.pk.std === 2 && c.pk.start === 1 && c.dk.length === B.DECK_SIZE && !('X' in c.o) && c.bt.x === 'w' && !c.bt.y && refused,
      detail: `kit ${kit}, packs ${packs}`};
  });
  check('Gridiron Dynasty: the Starter Pack (the owner, Oct 29 2026: "15 common players 4 rare players and one epic or better player") gives twenty different Live players, 15 Common, 4 Rare and one Epic or better, and opening it makes a legal 20-card deck', () => {
    const P = D.PACKS.start, ids = D.drawPack('start', {R: D.rng('starter-check')}), cs = ids.map(D.card);
    const by = r => cs.filter(c => c && c.r === r).length;
    const shape = ids.length === 20 && cs.every(c => c && c.s === 'L') && new Set(cs.map(c => c.p)).size === 20
      && by('common') === 15 && by('rare') === 4 && ['epic', 'legendary', 'mythic'].includes(cs[19].r);
    const odds = D.packOdds('start').every(g => Math.abs(g.odds.reduce((t, o) => t + o.pct, 0) - 100) < 0.6);
    const s = D.fresh('m_start', 1000), r = D.open('start', {}, s), deck = B.checkDeck(s.dk, s.o);
    const opened = r.ok && r.cards.length === 20 && !s.pk.start && deck.ok && s.dk.some(id => D.trainer(id)) && !D.open('start', {}, s).ok;
    return {pass: P.price === 0 && P.starter && shape && odds && opened, detail: `${by('common')} Common, ${by('rare')} Rare, last ${cs[19] && cs[19].r}; deck ${deck.ok ? 'legal' : deck.why}`};
  });
  check('Gridiron Dynasty battles: a deck is 20 cards, at most 2 of any player (a Live and a Gameday card of him count together) or card, with a Basic player; the best deck built from a collection is legal', () => {
    const f = started('m_deck'), ok = B.checkDeck(f.dk).ok;
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
    const d0 = started('m_a').dk, d1 = started('m_b').dk, seed = 'bcheck1';
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
    const none = D.open('leg', {free: true}, s).ok && D.open('leg', {free: true}, s).ok && !s.pk.leg && s.sp === 0;
    const got = Object.values(s.o).reduce((t, n) => t + n, 0) - o === 5 + 3 + 3;
    const others = !D.open('leg', {free: false}, s).ok;
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
    const cards = V.startCards(), teams = new Set(cards.map(c => c.team)).size, drawn = (start.match(/class="pk-start-card z-/g) || []).length;
    // (the support id: the same for a profile every time, another's another, never the profile's key)
    const ids = [V.supportId('m_evan'), V.supportId('m_evan'), V.supportId('u_ryan-stewart')];
    const battle = V.battleHome({pack: 'std'}, D.fresh('m_check'));
    const modes = ['class="rh-hero"', 'class="rh-play"', 'class="rh-active-deck" data-dy-tab="decks"', 'data-dy-bv="versus"', 'data-dy-bv="solo"', 'data-dy-guide', 'data-dy-bv="rank"', 'Collections'].every(x => battle.includes(x));
    return {pass: tabs === 4 && nav && menu && logo && bits && say && cards.length === 14 && teams >= 10 && drawn === (D.status === 'ready' ? 14 : 0) && ids[0] === ids[1] && ids[0] !== ids[2] && !/EVAN/.test(ids[0]) && modes,
      detail: `${tabs} tabs; ${cards.length} cards from ${teams} teams drift on the title screen; support id ${ids[0]}`};
  });
  check('Gridiron Dynasty: each rarity’s reveal on the deal grows with it (the owner, Oct 29 2026: "The more rare the player, the more exciting the animation"): ◆ dealt face up, ◆◆ flips, ◆◆◆ a ring, sparks and its stamp, ◆◆◆◆ rays, a flash and confetti, ★ and ★★ the drum and the sweep, ♛ the crown and the most of everything', async () => {
    const O = await import('../views/dynasty-open.js');
    const pick = f => D.CARDS.find(f);
    const cards = [pick(c => c.r === 'common' && c.s === 'L'), pick(c => c.r === 'rare' && c.s === 'L'), pick(c => c.r === 'epic' && c.s === 'L'), pick(c => c.r === 'legendary' && c.s === 'L'),
      pick(c => c.r === 'mythic' && c.s === 'L'), pick(c => c.s === 'P'), pick(c => c.s === 'X')];
    const R = cards.map(O.revealOf);
    const tiers = R.map(r => r.tier).join() === '0,1,2,3,4,5,6';
    const up = k => R.every((r, i) => !i || r[k] >= R[i - 1][k]);
    // (and each tier a clear step past the last in at least one of them: never two the same)
    const step = R.every((r, i) => !i || ['hold', 'total', 'sparks', 'confetti'].some(k => r[k] > R[i - 1][k]));
    const more = up('hold') && up('flip') && up('sparks') && up('confetti') && up('total') && step && R.every((r, i) => !i || r.haptics.length >= R[i - 1].haptics.length) && R[6].total > R[0].total * 4
      && R[5].sparks > R[4].sparks && R[5].confetti > R[4].confetti && R[5].total > R[4].total;
    const labels = R.map(r => r.label).join() === ',,Epic,Legendary,Mythic,Prime,Legend';
    // (a Trainer card by its rarity: an Epic one tier 2, a Legendary one tier 3, stamped so; the rarest dealt last)
    const tr = D.TRAINER_IDS.map(D.trainer), te = tr.find(t => t.r === 'epic'), tl = tr.find(t => t.r === 'legendary');
    const trainers = !!te && !!tl && O.revealOf(te).tier === 2 && O.revealOf(te).label === 'Epic' && O.revealOf(tl).tier === 3 && O.revealOf(tl).label === 'Legendary';
    const dealt = O.dealOrder([cards[6], cards[0], tl, cards[5], cards[2], te, cards[4]]).map(O.revealOf).map(r => r.tier);
    const order = dealt.every((t, i) => !i || t >= dealt[i - 1]) && dealt[0] === 0 && dealt[6] === 6;
    const html = O.dealHTML(cards[6], R[6], '<div class="pk-card"></div>', true);
    const crown = /class="pk-deal-c t-6 is-flip is-shake"/.test(html) && /pk-fx-crown/.test(html) && /pk-fx-rays/.test(html) && /pk-fx-flash/.test(html) && /pk-fx-sweep/.test(html)
      && (html.match(/class="pk-spk"/g) || []).length === 22 && /pk-deal-tag">Legend</.test(html) && /pk-flip-back/.test(html) && /NEW/.test(html);
    const plain = O.dealHTML(cards[0], R[0], '<div class="pk-card"></div>', false);
    const common = /class="pk-deal-c t-0 is-face"/.test(plain) && !/pk-spk|pk-fx-|pk-deal-tag|NEW/.test(plain);
    const epic = O.dealHTML(cards[2], R[2], '', false);
    const mid = /t-2 is-flip"/.test(epic) && /pk-fx-ring/.test(epic) && !/pk-fx-rays|pk-fx-flash|pk-fx-sweep|pk-fx-crown/.test(epic) && /pk-deal-tag">Epic</.test(epic);
    return {pass: tiers && more && labels && trainers && order && crown && common && mid,
      detail: `tiers ${R.map(r => r.tier).join(' < ')}; ${R.map(r => `${r.name} ${r.total}ms`).join(', ')}`};
  });
  check('Gridiron Dynasty: every pack comes in several art designs, more detailed the rarer the pack (the owner, Oct 29 2026: "Add more art designs to the packs. The more rare the pack, the more detailed the art design should be"): at least three each, the average and the plainest design of each tier above the tier below, each within its budget, no SVG filters below Gameday, ids a pack’s own (two on a page share none), a stored design past the end wrapped', async () => {
    const P = await import('../views/dynasty-packs.js');
    const BUDGET = {1: 30, 2: 55, 3: 90, 4: 150, 5: 240}, kinds = ['start', ...D.PACK_ORDER], by = {};
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
  check('Gridiron Rivals: collectible cards share a clear portrait, name, OVR and rarity layout; original trading-card scans remain in detail with the selected edition marked; collection identity, rarity and namesake matching are preserved', async () => {
    const [V, R] = await Promise.all([import('../views/dynasty.js'), import('./dynasty-real.js')]);
    const keys = Object.keys(R.REAL), cards = D.CARDS.filter(c => R.REAL[c.p]);
    const known = keys.length >= 16 && keys.every(p => D.DATA.players[p] && D.CARDS.some(c => c.p === p) && R.REAL[p].length
      && R.REAL[p].every(r => /^[0-9a-f]{8}$/.test(r[0]) && r[1] >= 1990 && r[2] && r[4]));
    const shows = cards.every(c => {
      const h = V.cardHTML(c);
      const el = document.createElement('div'); el.innerHTML = h;
      const portrait = c.head && !/^https?:/.test(c.head);
      return !!c.real && R.REAL[c.p].includes(c.real) && c.r !== 'common' && D.markOf(c).full && /class="pk-card [^"]*is-full r-/.test(h)
        && el.querySelector('.pk-c-name')?.textContent === c.name && el.querySelector('.pk-c-ovr b')?.textContent === String(c.o)
        && el.querySelector('.pk-c-rar')?.textContent === c.r && !el.querySelector('.pk-c-ph.is-real')
        && (portrait ? el.querySelector('.pk-c-ph')?.getAttribute('src') === V.headUrl(c.head) : !!el.querySelector('.pk-c-num'))
        && V.realHTML(c).includes(R.realUrl(c.p, c.real));
    });
    const commons = D.CARDS.filter(c => c.r === 'common'), framed = commons.length > 0 && commons.every(c => !c.real && !D.markOf(c).full && D.markOf(c).mark === '◆')
      && commons.filter(c => c.head).slice(0, 50).every(c => { const h = V.cardHTML(c); return !/is-real|is-full/.test(h) && h.includes(V.isPhoto(c.head) ? 'class="pk-c-ph is-photo" src=' : 'class="pk-c-ph" src='); });
    // (the foil: the rarity's class on the card, which css/views/dynasty.css animates from Epic up)
    const foil = ['common', 'rare', 'epic', 'legendary', 'mythic'].every(r => { const c = D.CARDS.find(x => x.r === r); return c && V.cardHTML(c).includes(` r-${r} `); });
    const allen = D.CARDS.filter(c => c.p === '0034857').map(c => c.real), apart = allen.length >= 3 && new Set(allen).size === allen.length;
    const up = V.realHTML(D.card('Xtombrady')), close = (up.match(/<figure/g) || []).length === R.REAL.xtombrady.length && (up.match(/On this card/g) || []).length === 1;
    const lb = D.CARDS.filter(c => c.name === 'Justin Jefferson' && c.pos === 'LB'), namesake = lb.length > 0 && lb.every(c => !c.real && c.r === 'common' && !V.realHTML(c));
    const urls = keys.flatMap(p => R.REAL[p].map(r => R.realUrl(p, r)));
    const got = await Promise.all(urls.map(u => fetch(u, {method: 'HEAD', cache: 'no-store'}).then(r => r.ok).catch(() => false)));
    return {pass: known && shows && framed && foil && apart && close && namesake && got.every(Boolean),
      detail: `${urls.length} pictures for ${keys.length} players on ${cards.length} cards, ${commons.length} Common; Josh Allen’s ${allen.map(R.realName).join(', ')}; missing ${urls.filter((u, i) => !got[i]).join(', ') || 'none'}`};
  });
  check('Gridiron Rivals: the Legends’ photos (the owner, Oct 31 2026: "Import into game for me to see"): a Legend with a freely licensed Wikimedia photo shows it as his card’s portrait, filling the window; his card up close credits its author, licence and Commons page; a Legend without one keeps his number; every photo loads', async () => {
    const [V, L, data] = await Promise.all([import('../views/dynasty.js'), import('./dynasty-legends.js'), import('./data.js')]);
    const keys = Object.keys(L.PHOTO), legends = D.CARDS.filter(c => c.s === 'X');
    const known = keys.length >= 100 && keys.every(p => D.DATA.players[p] && p.startsWith('x') && L.PHOTO[p].length === 5 && L.PHOTO[p][1] && L.PHOTO[p][2] && L.PHOTO[p][3]);
    const shows = legends.every(c => {
      const el = document.createElement('div'); el.innerHTML = V.cardHTML(c);
      const img = el.querySelector('.pk-c-ph');
      if (!L.PHOTO[c.p]) return !img && !!el.querySelector('.pk-c-num') && !V.creditHTML(c);
      const cr = V.creditHTML(c), r = L.legendCredit(c.p);
      return c.head === 'w:' + c.p && img?.classList.contains('is-photo') && img.getAttribute('src') === L.legendUrl(c.p)
        && cr.includes(r.page) && cr.includes(data.esc(r.author)) && cr.includes(data.esc(r.licence));
    });
    // (a cut-out headshot stays one: a Live card's portrait isn't a photo)
    const live = D.CARDS.find(c => c.s === 'L' && c.head), cut = !!live && !V.isPhoto(live.head) && !V.cardHTML(live).includes('is-photo');
    const urls = keys.map(L.legendUrl);
    const got = await Promise.all(urls.map(u => fetch(u, {method: 'HEAD', cache: 'no-store'}).then(r => r.ok).catch(() => false)));
    return {pass: known && shows && cut && got.every(Boolean),
      detail: `${keys.length} of ${legends.length} Legends with a photo; without: ${legends.filter(c => !L.PHOTO[c.p]).map(c => c.name).join(', ') || 'none'}; missing ${urls.filter((u, i) => !got[i]).join(', ') || 'none'}`};
  });
}
