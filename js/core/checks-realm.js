// Keepfall's checks for the dev gallery (#/_kit) (the game was the Realm till Oct 21 2026: its ids and saves keep that
// name): that it's the owner's alone (the case, the screens, the save, his
// own docs only, the computer's realms the only ones to attack or scout), scouting a realm, what the games pay (the old
// pay kept for the days before NEW_PAY; from then, Ale by place on three boards and Gold from Kick It and Return Man),
// storage and the coffers (never below nothing, and what their sheet says), mines and breweries, builders and the Castle's limits, training, an attack played out (the same every time), a dragon over walls,
// the computer's raids on the owner's realm, the cannon and the dragon hatchery, the art the buildings and folk are
// drawn from, an old Franchise save taken up as a realm, and the words on screen (Ale, breweries, cellars, the Castle,
// Keepfall). checks.js imports
// realmChecks and calls it with its check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here
// writes to storage or the database.
import * as F from './realm.js';
import * as daily from './daily.js';
import * as data from './data.js';
import {makeBattle, replay, raidsDue, defend, replayBattle, replayRaid, exampleRaids, ensureExamples, raidArmy} from './realm-battle.js';

const T0 = Date.UTC(2026, 9, 21, 12);
const DAY = 24 * F.HOUR;

export async function realmChecks(check) {
  const [kk, rm, sv, dr] = await Promise.all([import('./kick.js'), import('./return.js'), import('./seventeen.js').then(async m => { await m.load(); return m; }),
    import('./drill.js').then(async m => { await m.load(); return m; })]);

  check('Keepfall: the owner’s alone: its Daily Games case and pushed route open only on his phones; it has no separate tab, its screens are empty elsewhere and its save refuses; it reads only his own board docs, never LB.all, and attacks and scouts only the computer’s realms', async () => {
    const owner = !!data.isOwner();
    const [app, view, raid, scout, games, replayView] = await Promise.all([import('../app.js'), import('../views/realm.js'), import('../views/realm-raid.js'), import('../views/realm-scout.js'), import('../views/games.js'), import('../views/realm-replay.js')]);
    const may = F.mayPlay() === owner;
    const btn = document.querySelector('#tabbar .tab[data-tab="realm"]');
    const route = app.parseRoute('/puzzles/keep'), legacy = app.parseRoute('/realm');
    const tab = !app.TABS.includes('realm') && (!btn || btn.hidden)
      && games.gamesFor().some(g => g.id === 'keep') === owner
      && (owner ? route.view === 'realm' && route.open === 'push' && route.tab === 'puzzles' : route.path === '/puzzles')
      && legacy.path === route.path;
    const screens = [view.default, raid.default, scout.default, replayView.default].every(v => /rl-none/.test(v.render()) === !owner);
    const files = ['../views/realm.js', '../views/realm-raid.js', '../views/realm-scout.js', './realm.js', './realm-battle.js', '../views/realm-replay.js'];
    const src = await Promise.all(files.map(f => fetch(new URL(f, import.meta.url)).then(r => r.text())));
    const all = files.filter((f, i) => /LB\.all\b/.test(src[i]));
    const fl = src[3].slice(src[3].indexOf('export async function flush'));
    const guard = /!mayPlay\(\)[^\n]*\) return false;/.test(fl.slice(0, fl.indexOf('LB.put(')));
    const refused = owner ? 'not tried (the owner’s phone)' : String(await F.flush());
    const others = [{id: 'fx-m', nick: data.me() === 'mason' ? 'Evan' : 'Mason', fr1: F.fresh(T0)}, {id: 'fx-g', nick: 'Zed Q', g: true, fr1: F.fresh(T0)}];
    const mineOnly = F.myDocs(others).length === 0 && (!daily.LB.uid || F.myDocs(others.concat({id: daily.LB.uid, nick: daily.LB.nick})).length === 1);
    const tg = view.targets(T0, F.fresh(T0));
    const bots = tg.length === F.BOTS.length && tg.every(x => x.k.startsWith('bot:')) && !!F.realmOf('mason', F.fresh(T0)).why;
    const ok = may && tab && screens && !all.length && guard && (owner || refused === 'false') && mineOnly && bots;
    return {pass: ok, detail: `this phone the owner’s: ${owner}; mayPlay ${F.mayPlay()}; tab ${tab}; screens ${screens}; ${all.length ? 'reads LB.all: ' + all.join(', ') : 'LB.raw only'}; save guarded ${guard}, refused here: ${refused}; only his docs ${mineOnly}; attackable ${tg.map(x => x.k).join(',')}`};
  });

  check('Keepfall: scouting (views/realm-scout.js, #/realm/scout/<realm>): each of the computer’s realms can be looked round before it’s attacked, the same lot and take the attack meets, its defenses counted, a building’s card saying what it does and holds, a defense’s reach drawn round it; looking changes nothing', async () => {
    const [app, view, scout] = await Promise.all([import('../app.js'), import('../views/realm.js'), import('../views/realm-scout.js')]);
    const r = app.__dev.parseRoute('/realm/scout/bot%3A4'), routed = !data.DATA || !data.isOwner() ? true : !!r && r.view === 'realm-scout' && r.open === 'cover';
    // (a realm at the top Castle: every one of theirs in reach, Castle 4's rule aside: its own check)
    const s = F.fresh(T0);
    s.b.find(b => b.t === 'keep').l = F.MAX_KEEP;
    const before = JSON.stringify(s);
    const all = F.BOTS.map(b => ({b, R: F.realmOf(b.k, s, T0)}));
    const same = all.every(({b, R}) => !R.why && R.name === b.name && R.th === b.th && JSON.stringify(R.base) === JSON.stringify(F.botBase(b.th))
      && JSON.stringify(R.loot.total) === JSON.stringify(F.botLoot(b, F.botBase(b.th), s, T0).total));
    const R4 = all[3].R, def = scout.defensesOf(R4.base), counted = def.reduce((a, d) => a + d.n, 0) === R4.base.b.filter(b => F.KINDS[b.t].role === 'def' || b.t === 'wall').length && def.length > 0;
    const cannon = R4.base.b.find(b => b.t === 'cannon'), facts = cannon ? view.factsOf(cannon).join(' · ') : '';
    const card = new RegExp(`reach ${F.KINDS.cannon.range}`).test(facts) && /strength/.test(facts);
    const missing = !!F.realmOf('nowhere', s, T0).why;
    const untouched = JSON.stringify(s) === before;
    const ok = routed && same && counted && card && missing && untouched;
    return {pass: ok, detail: `route ${routed}; every realm the attack’s own ${same}; ${R4.name}: ${def.map(d => `${d.n} ${d.t}`).join(', ')} (${counted}); a cannon: ${facts}; an unknown realm refused ${missing}; nothing changed ${untouched}`};
  });

  check('Keepfall: the old pay, kept for every game day before the new pay (NEW_PAY): in Gold and Ale alike, a day each (the first finished across his phones; Return Man’s best run): Daily Puzzles 400 + 5 a point, 17–0 400 + 150 a win, Kick It 400 + 200 a make (to 15), Return Man 400 + 3 a yard (to 1,000)', () => {
    const a = {id: 'fx-a', nick: 'Evan', days: {10: {v: 4, p: 400, t: 2}}, kk1: {2: {m: 5, l: 40, y: 150, k: 8, t: 10}}, rm2: {1: {y: 300, l: 300, td: 3, t: 5}}, s17: {3: {w: 12, l: 5, p: 21.5, r: 0, k: '01234', t: 3}}};
    const b = {id: 'fx-b', nick: 'Evan', days: {10: {v: 4, p: 600, t: 5}, 11: {v: 4, p: 100, t: 6}}, kk1: {2: {m: 9, l: 48, y: 330, k: 12, t: 20}}, rm2: {1: {y: 900, l: 900, td: 9, t: 9}}};
    const inc = F.incomeOf([a, b], {kk, rm, sv}, {board: [], me: null});
    const want = {puzzles: 2400 + 900, '17-0': 400 + 150 * 12, kick: 400 + 200 * 5, return: 400 + 3 * 900}, sum = Object.values(want).reduce((x, y) => x + y, 0);
    const ok = Object.entries(want).every(([g, v]) => inc.by[g] && inc.by[g].gold === v && inc.by[g].grain === v) && inc.total.gold === sum && inc.total.grain === sum;
    const before = 10 < F.NEW_PAY.puzzles && 11 < F.NEW_PAY.puzzles && 3 < F.NEW_PAY['17-0'] && 2 < F.NEW_PAY.kick && 1 < F.NEW_PAY.return;
    const cap = F.PAY.kick({m: 40}) === 3400 && F.PAY.return({y: 5000}) === 3400 && F.PAY['17-0']({w: 17}) === 400 + 150 * 17 + 500;
    return {pass: ok && before && cap, detail: `by ${JSON.stringify(inc.by)} total ${JSON.stringify(inc.total)}; old days ${before}; caps ${cap}`};
  });

  // The new pay (the owner, Oct 21 2026), worked on one made-up season seen at noon four days after its first day, SHIP
  // (each game’s days then: AT_N): his two phones’ docs (fx-e1, fx-e2), the league’s, a guest’s and an app user’s who
  // isn’t in the league (Ryan S: on his boards, as his phones show them, but on no one else’s; both above him) and a row
  // that is no one’s (on no one’s board), filtered as his phone’s board is (daily.boardShows, the owner’s). His places
  // are the league’s board’s (league: the members’ rows and Ryan D’s), so neither the guest nor Ryan S lowers them.
  const SHIP = kk.dateOf(F.NEW_PAY.kick), on = (d, h = 12, m = 0) => new Date(SHIP.getFullYear(), SHIP.getMonth(), SHIP.getDate() + d, h, m);
  const AT = on(4);
  const econ = () => {
    const M = (data.DATA && data.DATA.managers) || [], nick = id => (M.find(m => m.id === id) || {}).name;
    const others = M.map(m => m.id).filter(id => id !== data.OWNER).slice(0, 8);
    if (!nick(data.OWNER) || others.length < 8 || !daily.PZ) return null;
    const P = F.NEW_PAY, AT_N = F.todayNumbers({sv, dr, kk, rm}, AT);
    // (a Daily Puzzles entry of the shape day n's board takes)
    const pe = (n, p, t) => { const v = daily.dayVersion(daily.dayFor(n)); return Object.assign(v === 4 ? {v: 4} : v === 3 ? {v: 3} : v === 2 ? {s: 0} : {}, {p, t}); };
    const doc = (id, who, f = {}) => Object.assign({id, nick: who}, f);
    const e1 = doc('fx-e1', nick(data.OWNER), {
      days: {[P.puzzles - 1]: {v: 4, p: 400, t: 1}, [P.puzzles]: pe(P.puzzles, 700, 100), [AT_N.puzzles - 1]: pe(AT_N.puzzles - 1, 900, 100), [AT_N.puzzles]: pe(AT_N.puzzles, 600, 100)},
      s17: {[P['17-0'] - 1]: {w: 10, l: 7, p: 18, t: 1}, [P['17-0']]: {w: 12, l: 5, p: 20.1, t: 100}},
      dr5: {[P.drill - 1]: {r: 'W', u: 21, h: 14, p: 9, t: 1}, [P.drill]: {r: 'L', u: 10, h: 14, p: 12, t: 100}, [AT_N.drill]: {r: 'T', u: 14, h: 14, p: 10, t: 100}},
      kk1: {[P.kick - 1]: {m: 6, l: 35, y: 200, k: 9, t: 1}, [P.kick]: {m: 12, l: 40, y: 400, k: 15, t: 100}, [P.kick + 1]: {m: 14, l: 44, y: 480, k: 17, t: 200},
        [P.kick + 2]: {m: 5, l: 33, y: 160, k: 8, t: 100}, [AT_N.kick]: {m: 10, l: 38, y: 330, k: 13, t: 100}},
      rm2: {[P.return - 1]: {y: 500, l: 500, td: 5, t: 1}, [P.return]: {y: 2000, l: 2000, td: 20, t: 50, c: 84}, [P.return + 1]: {y: 900, l: 900, td: 9, t: 500},
        [P.return + 2]: {y: 200, l: 200, td: 2, t: 10, c: 999999}, [P.return + 3]: {y: 150, l: 150, td: 1, t: 10, c: 900}, [AT_N.return]: {y: 400, l: 400, td: 4, t: 10, c: 12}}
    });
    // (his other phone: a later, better Daily score and 17–0 season that day, which the boards don't count; the first
    // Kick It run of a day, a short one; the first Return Man run of a day, its coins, his best run that day the other phone's)
    const e2 = doc('fx-e2', nick(data.OWNER), {days: {[P.puzzles]: pe(P.puzzles, 950, 200)}, s17: {[P['17-0']]: {w: 16, l: 1, p: 30, t: 300}},
      kk1: {[P.kick + 1]: {m: 4, l: 31, y: 120, k: 7, t: 50}}, rm2: {[P.return + 1]: {y: 100, l: 100, td: 1, t: 100, c: 30}}});
    const [o1, o2, o3, o4, o5, o6, o7] = others.map(id => nick(id));
    const league = [
      doc('fx-o1', o1, {days: {[P.puzzles]: pe(P.puzzles, 900, 50), [AT_N.puzzles - 1]: pe(AT_N.puzzles - 1, 800, 50), [AT_N.puzzles]: pe(AT_N.puzzles, 800, 50)},
        s17: {[P['17-0']]: {w: 14, l: 3, p: 25, t: 50}}, dr5: {[P.drill]: {r: 'W', u: 21, h: 14, p: 9, t: 50}}}),
      doc('fx-o2', o2, {days: {[P.puzzles]: pe(P.puzzles, 700, 60)}, s17: {[P['17-0']]: {w: 12, l: 5, p: 20.1, t: 60}}, dr5: {[P.drill]: {r: 'W', u: 21, h: 14, p: 9, t: 60}}}),
      doc('fx-o3', o3, {days: {[P.puzzles]: pe(P.puzzles, 500, 70)}, s17: {[P['17-0']]: {w: 12, l: 5, p: 19, t: 70}}, dr5: {[P.drill]: {r: 'W', u: 21, h: 14, p: 9, t: 70}}}),
      ...[o4, o5, o6, o7].map((n, i) => doc('fx-o' + (4 + i), n, {dr5: {[P.drill]: {r: 'W', u: 21, h: 14, p: 9, t: 80 + i}}})),
      doc('fx-g', 'Zed Q', {g: true, days: {[P.puzzles]: pe(P.puzzles, 1000, 40)}}),
      doc('fx-u', 'RyStew', {s17: {[P['17-0']]: {w: 15, l: 2, p: 26, t: 45}}, days: {[AT_N.puzzles]: pe(AT_N.puzzles, 950, 45)}}),
      doc('fx-x', 'Testy McTest', {days: {[P.puzzles]: pe(P.puzzles, 2000, 30)}, s17: {[P['17-0']]: {w: 17, l: 0, p: 40, t: 30}}})
    ];
    const all = [e1, e2, ...league], board = all.filter(p => daily.boardShows(p, true)), leagueBoard = all.filter(p => daily.boardShows(p, false));
    const inc = F.incomeOf([e1, e2], {sv, dr, kk, rm}, {board, me: data.OWNER, at: AT});
    // (a day whose entry says more coins than a 150-yard run could have run through: paid what the course lays out there,
    // and the day a forged count: what Return Man's own reading makes of it, dayCoins, whatever that is)
    const cutCoins = rm.coinsWithin(P.return + 3, 150), cut = F.coinGold(rm.dayCoins([e1, e2], P.return + 3));
    const forged = F.coinGold(rm.dayCoins([e1, e2], P.return + 2));
    // (the competitive pay, Oct 22 2026: Kick It 500 + 3,000 a 5th make; Return Man 500 a day + 25 a coin, the first 200)
    const kickNew = {[P.kick]: 500 + 3000 * 2, [P.kick + 1]: 500, [P.kick + 2]: 500 + 3000, [AT_N.kick]: 500 + 3000 * 2};
    const retNew = {[P.return]: 500 + 25 * 84, [P.return + 1]: 500 + 25 * 30, [P.return + 2]: 500 + forged, [P.return + 3]: 500 + cut, [AT_N.return]: 500 + 25 * 12};
    return {P, AT_N, e1, e2, all, board, leagueBoard, inc, pe, cut, cutCoins, forged, kickNew, retNew};
  };
  const sumOf = o => Object.values(o).reduce((a, b) => a + b, 0);
  const by = (inc, g, c) => (inc.by[g] ? inc.by[g][c] : 0);

  check('Keepfall: the new pay starts on Thu Oct 22 2026, the first day played after it shipped (the owner had played all of Oct 21’s games under the old pay), in every game’s own numbering (NEW_PAY: the Daily Puzzles’ 25th day, 17–0’s 14th, the Drill’s 8th, Kick It’s 5th, Return Man’s 3rd), written down, not worked out from the clock; the day before, each game’s last old day, keeps the old pay exactly, in Gold and Ale alike', () => {
    const G = {sv, dr, kk, rm}, first = F.todayNumbers(G, new Date(2026, 9, 22, 12)), eve = F.todayNumbers(G, new Date(2026, 9, 21, 23, 59));
    const ship = Object.keys(F.NEW_PAY).every(g => first[g] === F.NEW_PAY[g] && eve[g] === F.NEW_PAY[g] - 1) && Object.isFrozen(F.NEW_PAY) && SHIP.getTime() === new Date(2026, 9, 22).getTime()
      && F.NEW_PAY_DATE === '2026-10-22' && F.oldPayToday({day: eve}) && !F.oldPayToday({day: first});
    const E = econ();
    if (!E) return {pass: false, detail: `the league or the puzzles didn’t load; Oct 22: ${JSON.stringify(first)}`};
    const old = {puzzles: 400 + 5 * 400, '17-0': 400 + 150 * 10, drill: 3000, kick: 400 + 200 * 6, return: 400 + 3 * 500};
    // (each game’s Gold and Ale: the old day’s in both; the new days’ in their own one only)
    const newGold = {kick: sumOf(E.kickNew), return: sumOf(E.retNew)}, newAle = {puzzles: 4000 + 5000, '17-0': 4000, drill: 1200};
    const split = Object.keys(old).every(g => by(E.inc, g, 'gold') === old[g] + (newGold[g] || 0) && by(E.inc, g, 'grain') === old[g] + (newAle[g] || 0));
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    const totals = E.inc.total.gold === sum(old) + sum(newGold) && E.inc.total.grain === sum(old) + sum(newAle);
    return {pass: ship && split && totals, detail: `Oct 22: ${JSON.stringify(first)}, Oct 21: ${JSON.stringify(eve)} (${ship}); by game ${JSON.stringify(E.inc.by)} (${split}); total ${JSON.stringify(E.inc.total)} (${totals})`};
  });

  check('Keepfall: from the new pay on, Ale for his place on the day’s final board in the Daily Puzzles, 17–0 and the Two-Minute Drill (1st 5,000 · 2nd 4,000 · 3rd 3,200 · 4th 2,600 · 5th 2,100 · 6th 1,700 · 7th or lower 1,200), ranked as each game’s own board ranks it, on the league’s board: a tie shares the higher place, he counts once across his phones (the board’s counting entry, not a later better one), a guest or an app user who isn’t in the league (Ryan S) above him on his phone’s boards doesn’t lower his place (they’re not on the league’s), Ryan D would, and a row that is no one’s doesn’t; paid the morning after (yesterday’s place came in today), today’s place pending (“#2 right now”), and no Gold from those three', () => {
    const E = econ();
    if (!E) return {pass: false, detail: 'the league or the puzzles didn’t load'};
    const {P, AT_N, inc, board, leagueBoard} = E;
    const table = [1, 2, 3, 4, 5, 6, 7, 8, 20].map(F.aleFor).join() === '5000,4000,3200,2600,2100,1700,1200,1200,1200' && F.aleFor(0) === 0;
    // (the boards themselves, as the games rank them: his row on each, the league’s; and on his phone’s, where the
    // guest and Ryan S are above him)
    const pzOn = b => daily.boardRows('today', daily.onePerMember(b), P.puzzles, daily.dayFor(P.puzzles)).find(r => r.id === 'fx-e1' || r.id === 'fx-e2');
    const rowPz = pzOn(leagueBoard), row17 = sv.boardRows('today', P['17-0'], leagueBoard).find(r => r.key === data.OWNER), rowDr = dr.boardRows(P.drill, leagueBoard).find(r => r.key === data.OWNER);
    const places = !!rowPz && rowPz.rank === 2 && rowPz.pts === 700 && !!row17 && row17.rank === 2 && row17.w === 12 && !!rowDr && rowDr.rank === 8;
    const his = pzOn(board), his17 = sv.boardRows('today', P['17-0'], board).find(r => r.key === data.OWNER);
    const outsiders = !!his && his.rank === 3 && !!his17 && his17.rank === 3 && board.some(p => p.id === 'fx-u') && board.some(p => p.id === 'fx-g')
      && !leagueBoard.some(p => p.id === 'fx-u' || p.id === 'fx-g' || p.id === 'fx-x');
    // (and Ryan D, the one app user on the league’s boards, does push him down)
    const rd = {id: 'fx-rd', nick: 'Ryan Dow', s17: {[P['17-0']]: {w: 16, l: 1, p: 29, t: 44}}};
    const withRd = F.incomeOf([E.e1, E.e2], {sv, dr, kk, rm}, {board: board.concat(rd), me: data.OWNER, at: AT});
    const ryanD = by(withRd, '17-0', 'grain') === 1900 + 3200;
    const ale = by(inc, 'puzzles', 'grain') === 2400 + 4000 + 5000 && by(inc, '17-0', 'grain') === 1900 + 4000 && by(inc, 'drill', 'grain') === 3000 + 1200;
    const noGold = by(inc, 'puzzles', 'gold') === 2400 && by(inc, '17-0', 'gold') === 1900 && by(inc, 'drill', 'gold') === 3000;
    const pend = inc.pending.puzzles && inc.pending.puzzles.n === AT_N.puzzles && inc.pending.puzzles.place === 2 && inc.pending.puzzles.grain === 4000
      && inc.pending.drill && inc.pending.drill.place === 1 && inc.pending.drill.grain === 5000 && !inc.pending['17-0'] && !inc.pending.kick && !inc.pending.return;
    const morning = inc.today.puzzles && inc.today.puzzles.grain === 5000 && inc.last.puzzles && inc.last.puzzles.n === AT_N.puzzles - 1 && inc.last.puzzles.place === 1
      && !(inc.today['17-0'] && inc.today['17-0'].grain) && !(inc.today.drill && inc.today.drill.grain);
    // (seen the next day, today's place is paid, and a day still to come pays nothing)
    const next = F.incomeOf([E.e1, E.e2], {sv, dr, kk, rm}, {board, me: data.OWNER, at: on(5, 9)});
    const paid = by(next, 'puzzles', 'grain') === 2400 + 4000 + 5000 + 4000 && by(next, 'drill', 'grain') === 3000 + 1200 + 5000 && !next.pending.puzzles;
    // (and seen on the first day itself, its places are pending, the day after the old pay's last)
    const early = F.incomeOf([E.e1, E.e2], {sv, dr, kk, rm}, {board, me: data.OWNER, at: on(0, 23, 59)});
    const notYet = by(early, 'puzzles', 'grain') === 2400 && early.pending.puzzles && early.pending.puzzles.place === 2 && by(early, '17-0', 'grain') === 1900 && early.pending['17-0'].place === 2;
    // (someone else's view of the same board: never his)
    const nobody = F.incomeOf([], {sv, dr, kk, rm}, {board, me: null, at: AT}).total;
    const none = nobody.gold === 0 && nobody.grain === 0;
    const ok = table && places && outsiders && ryanD && ale && noGold && pend && morning && paid && notYet && none;
    return {pass: ok, detail: `table ${table}; his places on the league’s board: Daily #${rowPz && rowPz.rank} (${rowPz && rowPz.pts}), 17–0 #${row17 && row17.rank}, Drill #${rowDr && rowDr.rank} (${places}); on his phone’s, with the guest and Ryan S above him: Daily #${his && his.rank}, 17–0 #${his17 && his17.rank}, not counted ${outsiders}; Ryan D above him counts ${ryanD}; Ale ${['puzzles', '17-0', 'drill'].map(g => by(inc, g, 'grain')).join('/')} (${ale}); no new Gold ${noGold}; pending ${JSON.stringify(inc.pending)} (${pend}); this morning ${JSON.stringify(inc.today.puzzles)} (${morning}); the next day paid ${paid}; on its first day still pending ${notYet}; no docs no pay ${none}`};
  });

  check('Keepfall: from the new pay on, Gold from Kick It and Return Man, paid as soon as the run is on the board (the competitive pay, Oct 22 2026): 500 for the run that counts and 3,000 for every 5th make on it (the day’s first finished across his phones, not a later better try; 0 makes still 500), and 500 a Return Man day with a run on the board plus 25 a coin on the day’s first run, the first 200 (its board entry’s c, whatever the best run was; none on a later run, never more than the course lays out); no Ale from those two', () => {
    const E = econ();
    if (!E) return {pass: false, detail: 'the league or the puzzles didn’t load'};
    const {inc, P} = E;
    const helpers = F.kickGold(0) === 500 && F.kickGold(4) === 500 && F.kickGold(5) === 3500 && F.kickGold(9) === 3500 && F.kickGold(10) === 6500 && F.kickGold(40) === 24500
      && F.kickGold(41) === 24500 && F.coinGold(84) === 2100 && F.coinGold(0) === 0 && F.coinGold(-3) === 0 && F.coinGold(200) === 5000 && F.coinGold(201) === 5000
      && F.returnGold(0) === 500 && F.returnGold(12) === 800 && F.COIN_FIELD === 'c';
    const kick = by(inc, 'kick', 'gold') === 1600 + sumOf(E.kickNew) && by(inc, 'kick', 'grain') === 1600 && inc.today.kick && inc.today.kick.gold === 6500;
    // (900 coins said on a 150-yard run: what the course lays out there, a few, 25 each)
    const cut = E.cutCoins > 0 && E.cutCoins < 900 && E.cut === 25 * Math.min(E.cutCoins, 200);
    const ret = by(inc, 'return', 'gold') === 1900 + sumOf(E.retNew) && by(inc, 'return', 'grain') === 1900 && inc.today.return && inc.today.return.gold === 800;
    // (his runs alone pay: the board's others don't; on his first phone the day's first run that had coins was the other's)
    const solo = F.incomeOf([E.e1], {sv, dr, kk, rm}, {board: E.board, me: data.OWNER, at: AT});
    const soloRet = 2600 + 500 + 500 + F.coinGold(rm.dayCoins([E.e1], P.return + 2)) + 500 + F.coinGold(rm.dayCoins([E.e1], P.return + 3)) + 800;
    const one = by(solo, 'kick', 'gold') === 1600 + 6500 + 6500 + 3500 + 6500 && by(solo, 'return', 'gold') === 1900 + soloRet;
    // (the coins as Return Man's core reads them, dayCoins, and as Keepfall reads them without it: the same)
    const own = typeof rm.dayCoins === 'function' && rm.dayCoins([E.e1, E.e2], F.NEW_PAY.return + 1) === 30;
    const bare = F.incomeOf([E.e1, E.e2], {sv, dr, kk, rm: Object.assign({}, rm, {dayCoins: null})}, {board: E.board, me: data.OWNER, at: AT});
    const same = JSON.stringify(bare.by.return) === JSON.stringify(inc.by.return);
    // (what the games' own screens promise, "+N Gold for Keepfall", is what Keepfall pays)
    const agree = typeof kk.goldOf === 'function' && Array.from({length: 41}, (_, m) => kk.goldOf(m) === F.kickGold(m)).every(Boolean)
      && !!kk.GOLD && kk.GOLD.each === F.KICK_GOLD && kk.GOLD.base === F.KICK_BASE && kk.GOLD.every === F.KICK_EVERY && kk.GOLD.from === F.NEW_PAY.kick
      && !!rm.COIN && rm.COIN.gold === F.COIN_GOLD && rm.COIN.most === F.COIN_MAX && rm.COIN.fromDay === F.NEW_PAY.return
      && (rm.COIN.base == null || rm.COIN.base === F.RETURN_BASE) && (rm.COIN.paid == null || rm.COIN.paid === F.COIN_PAID_MAX);
    return {pass: helpers && cut && kick && ret && one && own && same && agree, detail: `the games’ own numbers agree (Kick It ${JSON.stringify(kk.GOLD)}; Return Man’s coins ${rm.COIN && rm.COIN.gold} Gold, out from Keepfall’s first day of paying for them, ${rm.COIN && rm.COIN.fromDay}) ${agree}; helpers ${helpers}; a forged count paid only what the course lays out (${E.cutCoins} coins, ${E.cut} Gold) ${cut}; Kick It ${JSON.stringify(inc.by.kick)}, today ${JSON.stringify(inc.today.kick)} (${kick}); Return Man ${JSON.stringify(inc.by.return)}, today ${JSON.stringify(inc.today.return)} (${ret}); one phone’s docs alone ${one}; Return Man’s dayCoins ${own}, the same without it ${same}`};
  });

  check('Keepfall: a day’s place, once paid, stays paid: incomeOf lists the places it pays that weren’t frozen yet (fresh: the final days, never today’s), the realm keeps them (pd, through clean(), junk dropped), and a frozen day pays its place whatever’s posted to its board later; frozen only from the board as it really is (freezePaid refuses before it’s in); the coffers freeze them after the sync, from the realm’s own', async () => {
    const E = econ();
    if (!E) return {pass: false, detail: 'the league or the puzzles didn’t load'};
    const {P, AT_N} = E, G = {sv, dr, kk, rm}, fr = E.inc.fresh || {};
    const listed = !!fr.puzzles && fr.puzzles[P.puzzles] === 2 && fr.puzzles[AT_N.puzzles - 1] === 1 && !(AT_N.puzzles in fr.puzzles)
      && !!fr['17-0'] && fr['17-0'][P['17-0']] === 2 && !!fr.drill && fr.drill[P.drill] === 8 && !(AT_N.drill in fr.drill) && !fr.kick && !fr.return;
    // (a member's late post above him on a day already paid: unfrozen his place would drop, frozen it holds)
    const late = Object.assign({}, E.all.find(p => p.id === 'fx-o4'), {id: 'fx-late', days: {[P.puzzles]: E.pe(P.puzzles, 990, 20)}});
    const board = E.board.concat(late);
    const loose = F.incomeOf([E.e1, E.e2], G, {board, me: data.OWNER, at: AT}), held = F.incomeOf([E.e1, E.e2], G, {board, me: data.OWNER, at: AT, paid: fr});
    const drops = by(loose, 'puzzles', 'grain') === 2400 + 3200 + 5000;
    const holds = by(held, 'puzzles', 'grain') === 2400 + 4000 + 5000 && JSON.stringify(held.total) === JSON.stringify(E.inc.total) && !Object.keys(held.fresh).length;
    // (today's place is never frozen: it's still pending, and moves with the board)
    const today = F.incomeOf([E.e1, E.e2], G, {board: E.board, me: data.OWNER, at: AT, paid: {puzzles: {[AT_N.puzzles]: 1}}});
    const live = today.pending.puzzles && today.pending.puzzles.place === 2 && by(today, 'puzzles', 'grain') === by(E.inc, 'puzzles', 'grain');
    // (the realm keeps them)
    const s = F.fresh(T0);
    s.pd = {puzzles: {[P.puzzles]: 2, 26: 'x', 0: 3}, '17-0': {14: 1.5}, kick: {5: 1}, junk: 4};
    const kept = JSON.stringify(F.clean(s).pd) === JSON.stringify({puzzles: {[P.puzzles]: 2}}) && JSON.stringify(F.clean(F.fresh(T0)).pd) === '{}';
    const t = F.fresh(T0), a1 = F.freezeInto(t, fr), a2 = F.freezeInto(t, fr);
    const into = a1 && !a2 && t.pd.puzzles[P.puzzles] === 2 && t.pd.drill[P.drill] === 8 && !t.pd.kick;
    t.pd.puzzles[P.puzzles] = 1;
    const once = !F.freezeInto(t, fr) && t.pd.puzzles[P.puzzles] === 1; // (what's frozen stays frozen)
    let refused;
    const was = daily.LB.ready;
    try { daily.LB.ready = false; refused = !F.freezePaid(F.fresh(T0), fr); } finally { daily.LB.ready = was; }
    const src = await fetch(new URL('../views/realm.js', import.meta.url)).then(r => r.text()).catch(() => '');
    // (the docs his own, F.myDocs(), by way of a const docs: Oct 22 2026, for today's runs too; the realm's own pd, and
    // its born: count from the start day)
    const view = /const docs = F\.myDocs\(\), s = F\.mine\(\);\s+EARNED = F\.incomeOf\(docs, MODS, \{paid: s\.pd, from: s\.born\}\)/.test(src) && /const froze = F\.freezePaid\(s, EARNED\.fresh\);\s+if \(got\.gold \|\| got\.grain \|\| froze\) F\.touch\(\);/.test(src);
    const ok = listed && drops && holds && live && kept && into && once && refused && view;
    return {pass: ok, detail: `fresh ${JSON.stringify(fr)} (${listed}); a late post above him: unfrozen ${by(loose, 'puzzles', 'grain')} Ale (${drops}), frozen ${by(held, 'puzzles', 'grain')} (${holds}); today’s still pending ${live}; kept by clean() ${kept}; frozen once ${into}, never changed ${once}; refused without the board ${refused}; the coffers freeze from the realm’s, after the sync ${view}`};
  });

  // ---- count from the start day (the owner, Oct 22 2026): a realm is paid only for the game days from the day it began
  check('Keepfall: count from the start day (the owner, Oct 22 2026): a realm is paid only for the game days from the day it began on (its born, in each game’s own numbering: startNumbers), old pay or new: one begun today earns today’s games alone (today’s Kick It and Return Man Gold, today’s places still pending; nothing for yesterday’s place or any day before), one begun yesterday adds yesterday’s, one begun before the season (or none given) the whole season as before; a game whose days aren’t loaded pays nothing till they are; a realm started over for testing is begun that moment, and clean() keeps when it began', () => {
    const E = econ();
    if (!E) return {pass: false, detail: 'the league or the puzzles didn’t load'};
    const {AT_N} = E, G = {sv, dr, kk, rm}, docs = [E.e1, E.e2], opts = from => ({board: E.board, me: data.OWNER, at: AT, from});
    const b0 = on(4, 8).getTime(), b1 = on(3, 21).getTime();
    const t0 = F.incomeOf(docs, G, opts(b0)), t1 = F.incomeOf(docs, G, opts(b1));
    const all = F.incomeOf(docs, G, opts(new Date(2026, 8, 1).getTime())), none = F.incomeOf(docs, G, opts(null));
    // (begun today: today's Gold alone; today's places pending as ever; nothing to freeze)
    const todayGold = E.kickNew[AT_N.kick] + E.retNew[AT_N.return];
    const today = t0.total.gold === todayGold && t0.total.grain === 0 && Object.keys(t0.by).sort().join() === 'kick,return'
      && JSON.stringify(t0.pending) === JSON.stringify(E.inc.pending) && !!t0.pending.puzzles && !Object.keys(t0.fresh).length
      && t0.today.kick.gold === E.inc.today.kick.gold && t0.today.return.gold === E.inc.today.return.gold && t0.from === b0 && t0.days < E.inc.days;
    // (begun yesterday: and yesterday's, its place paid this morning)
    const yGold = todayGold + (E.kickNew[AT_N.kick - 1] || 0) + (E.retNew[AT_N.return - 1] || 0);
    const yAle = F.RANKED.reduce((a, g) => a + ((E.inc.today[g] || {}).grain || 0), 0);
    const yesterday = yAle > 0 && t1.total.gold === yGold && t1.total.grain === yAle && Object.keys(t1.fresh.puzzles || {}).join() === String(AT_N.puzzles - 1);
    // (begun before the season, or no start given: the season as before)
    const season = JSON.stringify(all.total) === JSON.stringify(E.inc.total) && JSON.stringify(all.by) === JSON.stringify(E.inc.by)
      && JSON.stringify(none.total) === JSON.stringify(E.inc.total) && none.from === 0;
    // (the start's numbers: each game's own day; a game begun after it, its day 1; a game whose days aren't loaded, never)
    const sn = F.startNumbers(G, b0), early = F.startNumbers(G, new Date(2026, 0, 1).getTime()), bare = F.startNumbers({}, b0);
    const nums = Object.keys(AT_N).every(g => sn[g] === AT_N[g]) && Object.values(early).every(v => v === 1) && ['17-0', 'drill', 'kick', 'return'].every(g => bare[g] === Infinity);
    // (started over for testing: a new realm, begun that moment; clean() keeps when)
    const t = F.testRealm({nm: 'House X', at: T0 - DAY}, T0), kept = F.clean(JSON.parse(JSON.stringify(t)));
    const reset = t.born === T0 && t.tst === 1 && !!kept && kept.born === T0 && F.fresh(T0).born === T0;
    const ok = today && yesterday && season && nums && reset;
    return {pass: ok, detail: `begun today: ${JSON.stringify(t0.total)}, by ${Object.keys(t0.by).join('/')} (${todayGold} Gold today) ${today}; begun yesterday: ${JSON.stringify(t1.total)} (want ${yGold} Gold, ${yAle} Ale) ${yesterday}; before the season or none: ${JSON.stringify(all.total)} / ${JSON.stringify(none.total)}, the season ${JSON.stringify(E.inc.total)} ${season}; start numbers ${JSON.stringify(sn)} ${nums}; started over ${reset}`};
  });

  check('Keepfall: counting from the start day never takes back what’s been taken: a realm that took more from the coffers than it’s paid now (the whole season, counted before) has nothing waiting, never less; nothing moves, storage and what’s been taken stay as they were (a testing realm too); new pay waits again once it passes what was taken', () => {
    const s = F.fresh(T0);
    s.cl = {gold: 90000, grain: 80000}; s.r = {gold: 2200, grain: 2100};
    const before = JSON.stringify({r: s.r, cl: s.cl}), now = {gold: 7300, grain: 0};
    const p0 = F.pending(s, now), m0 = F.claim(s, now);
    const held = p0.gold === 0 && p0.grain === 0 && m0.gold === 0 && m0.grain === 0 && JSON.stringify({r: s.r, cl: s.cl}) === before;
    const p1 = F.pending(s, {gold: 95000, grain: 79000}), m1 = F.claim(s, {gold: 95000, grain: 79000});
    const passes = p1.gold === 95000 + 1500 - 90000 && p1.grain === 79000 + 1500 - 80000 && m1.gold === Math.min(p1.gold, F.capOf(s).gold - 2200) && m1.grain === 400;
    const t = F.testRealm(null, T0);
    t.cl = {gold: 90000, grain: 80000};
    const tp = F.pending(t, now), tm = F.claim(t, now);
    const testing = tp.gold === 0 && tp.grain === 0 && tm.gold === 0 && tm.grain === 0 && t.cl.gold === 90000 && t.cl.grain === 80000;
    return {pass: held && passes && testing, detail: `taken 90,000/80,000, paid now 7,300/0: waiting ${JSON.stringify(p0)}, moved ${JSON.stringify(m0)}, stored ${JSON.stringify(s.r)} ${held}; paid 95,000/79,000: waiting ${JSON.stringify(p1)}, moved ${JSON.stringify(m1)} ${passes}; a testing realm ${testing}`};
  });

  check('Keepfall: the coffers and the welcome say it: what the games have paid “Since your realm began” (the day it began), never “This season”; the welcome “from the day it began”; and his phone works the pay out from his realm’s own start, again whenever the realm is one begun another day (taken up from the board, or started over)', async () => {
    const view = await import('../views/realm.js');
    const E = econ();
    if (!E) return {pass: false, detail: 'the league or the puzzles didn’t load'};
    const s = F.fresh(on(4, 8).getTime()), inc = F.incomeOf([E.e1, E.e2], {sv, dr, kk, rm}, {board: E.board, me: data.OWNER, at: AT, from: s.born});
    const pages = view._screens(s, AT.getTime(), {earned: inc});
    const words = w => { const t = document.createElement('template'); t.innerHTML = (pages.find(p => p.where === w) || {}).html || ''; return t.content.textContent.replace(/\s+/g, ' '); };
    const cof = words('The coffers'), hi = words('Keepfall');
    const day = new Date(s.born).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'}).replace(',', '');
    const said = cof.includes('Since your realm began ' + day) && cof.includes('paid for the games you play from the day it began') && !/this season/i.test(cof + hi)
      && hi.includes('The daily games pay your realm for every day you play from the day it began.');
    const src = await fetch(new URL('../views/realm.js', import.meta.url)).then(r => r.text()).catch(() => '');
    const wired = /EARNED = F\.incomeOf\(docs, MODS, \{paid: s\.pd, from: s\.born\}\)/.test(src) && /if \(EARNED_DAY && \(EARNED_DAY !== F\.dayKey\(now\) \|\| EARNED\.from !== s\.born\)\) earned\(\);/.test(src);
    return {pass: said && wired, detail: `the coffers and the welcome ${said}; worked out from the realm’s start, again when it’s another ${wired}`};
  });

  check('Keepfall: the coffers never go below nothing: pay of each (Gold and Ale apart, or one number for both as before) waits there and moves into storage as there’s room, one currency without the other; pay that falls short of what’s been taken (a day’s place lower than when it paid) leaves nothing waiting, never less, and storage untouched', () => {
    const s = F.fresh(T0), moved = F.claim(s, {gold: 10000, grain: 0}), p = F.pending(s, {gold: 10000, grain: 0});
    const split = moved.gold === 2500 && moved.grain === 1500 && p.gold === 10000 + 1500 - 2500 && p.grain === 0;
    const same = JSON.stringify(F.pending(F.fresh(T0), 4000)) === JSON.stringify(F.pending(F.fresh(T0), {gold: 4000, grain: 4000}));
    const t = F.fresh(T0);
    t.cl = {gold: 50000, grain: 50000}; t.r = {gold: 700, grain: 900};
    const short = F.pending(t, {gold: 1000, grain: 0}), took = F.claim(t, {gold: 1000, grain: 0});
    const never = short.gold === 0 && short.grain === 0 && took.gold === 0 && took.grain === 0 && t.r.gold === 700 && t.r.grain === 900 && t.cl.gold === 50000;
    const junk = F.pending(F.fresh(T0), {gold: NaN, grain: undefined});
    const safe = junk.gold === 1500 && junk.grain === 1500;
    return {pass: split && same && never && safe, detail: `Gold alone: moved ${JSON.stringify(moved)}, waiting ${JSON.stringify(p)} (${split}); one number for both ${same}; short pay: waiting ${JSON.stringify(short)}, moved ${JSON.stringify(took)}, stored ${JSON.stringify(t.r)} (${never}); bad numbers ${JSON.stringify(junk)}`};
  });

  check('Keepfall: the coffers say how the games pay now (“Ale: your place on the Daily Puzzles, 17–0 and Two-Minute Drill boards, paid the next morning. Gold: …”, the Gold line with the competitive pay’s numbers), today’s place (“#2 right now · 4,000 Ale tomorrow if it holds”), today’s makes and coins as the runs have them (never the Gold worked back), what came in today and the season’s Gold and Ale for each game, and the competitive pay’s numbers (Oct 22 2026: 500 a run and 3,000 a 5th make; 500 a day and 25 a coin); on the old pay’s last day, that day’s pay the old way and what tomorrow brings; so does the welcome', async () => {
    const view = await import('../views/realm.js');
    const E = econ();
    if (!E) return {pass: false, detail: 'the league or the puzzles didn’t load'};
    // (today's runs as the coffers read them, from the entries: views/realm.js runsOf, as its earned() does)
    const withRuns = inc => (typeof view.runsOf === 'function' ? Object.assign({}, inc, {runs: view.runsOf([E.e1, E.e2], {sv, dr, kk, rm}, inc.day)}) : inc);
    const pages = view._screens(F.fresh(T0), T0, {earned: withRuns(E.inc)});
    // (the evening before the new pay: every game played that day, the old way)
    const eve = F.incomeOf([E.e1, E.e2], {sv, dr, kk, rm}, {board: E.board, me: data.OWNER, at: on(-1, 20)});
    const evePages = view._screens(F.fresh(T0), T0, {earned: withRuns(eve)});
    // (a page's words as one run of text, and node by node: an amount and its name, a picture's, sit in tags of their own)
    const nodes = (w, list = pages) => {
      const p = list.find(x => x.where === w), t = document.createElement('template'), out = [];
      t.innerHTML = p ? p.html : '';
      const wk = document.createTreeWalker(t.content, 4);
      while (wk.nextNode()) out.push(wk.currentNode.nodeValue);
      return {all: t.content.textContent.replace(/\s+/g, ' '), out};
    };
    const text = (w, list = pages) => { const n = nodes(w, list); return n.all + ' \n ' + n.out.join(' ').replace(/\s+/g, ' '); };
    // (a line: words, or a pattern one node of the page must match)
    const says = (w, list, l) => (typeof l === 'string' ? text(w, list).includes(l) : nodes(w, list).out.some(v => l.test(v.replace(/\s+/g, ' '))));
    const cof = text('The coffers'), hi = text('Keepfall');
    // (the line on how the games pay: the view's own, payCopyHTML, as words; it must say the Ale and the new Gold)
    const tc = document.createElement('template');
    tc.innerHTML = typeof view.payCopyHTML === 'function' ? view.payCopyHTML() : '';
    const copy = tc.content.textContent.replace(/\s+/g, ' ').trim();
    const copyOk = copy.startsWith('Ale: your place on the Daily Puzzles, 17–0 and Two-Minute Drill boards, paid the next morning. Gold: ')
      && /\b500\b.*\b3,000 for every 5th Kick It make\b.*\b25 a coin on your first Return Man run\b/.test(copy);
    const lines = [copyOk ? copy : 'the line on how the games pay (payCopyHTML) with the new Gold', '#2 right now · 4,000 Ale tomorrow if it holds', '#1 right now · 5,000 Ale tomorrow if it holds', '#1 yesterday: paid this morning', 'Not played yet: your place pays Ale tomorrow',
      '10 makes on your run', '12 coins on your first run', `All told ${E.inc.total.gold.toLocaleString('en-US')} Gold ${E.inc.total.grain.toLocaleString('en-US')} Ale`, '1st 5,000', '7th or lower 1,200',
      /Kick It\b.*\b500 Gold\b.*\b3,000\b.*\b5th make/, /Return Man\b.*\b500 Gold\b.*\b25 a coin/];
    const missing = lines.filter(l => !says('The coffers', pages, l)).map(String);
    const old = /400 plus|Gold and Ale alike|1,000 Gold every|10 Gold a coin|10 Gold each|\d+\+ makes/.test(cof + hi);
    const welcome = copyOk && hi.includes(copy);
    const last = text('The coffers', evePages), lastLines = ['Paid the old way: Gold and Ale alike', 'From tomorrow: your place on its board pays Ale', /^From tomorrow:.*\b500 Gold\b.*\b3,000\b.*\b5th make/,
      /^From tomorrow:.*\b500 Gold\b.*\b25 a coin/, `+ 2,400 Gold 2,400 Ale`];
    const lastMissing = lastLines.filter(l => !says('The coffers', evePages, l)).map(String), lastNew = /right now|this morning|on your run|on your first run today/.test(last);
    // (the old pay's last day: the lead says when the new one starts; from then, it doesn't)
    const starts = last.includes('Starting Thu Oct 22. ' + copy) && !cof.includes('Starting');
    if (!starts) lastMissing.push('Starting Thu Oct 22. (on the eve alone)');
    return {pass: !missing.length && !old && welcome && !lastMissing.length && !lastNew,
      detail: `${missing.length ? 'the coffers never say: ' + missing.join(' | ') : 'the coffers say it all'}; the old pay’s words ${old ? 'still there' : 'gone'}; the welcome ${welcome}; the old pay’s last day ${lastMissing.length ? 'never says: ' + lastMissing.join(' | ') : 'says it'}${lastNew ? ', but speaks of the new pay' : ''}`};
  });

  check('Keepfall: a new realm holds 2,500 of each in its Castle; the coffers keep what doesn’t fit (the games’ pay and the starter 1,500) and move it in as room opens; a gold mine digs 20 an hour up to 24 hours’ worth (a brewery the same: Oct 22 2026, was 10), collected as far as there’s room, and stops while it’s upgraded', () => {
    const s = F.fresh(T0), cap = F.capOf(s);
    const moved = F.claim(s, 10000), pend = F.pending(s, 10000);
    const mine = s.b.find(b => b.t === 'mine');
    const m3 = F.made(mine, T0 + 3 * F.HOUR), m30 = F.made(mine, T0 + 30 * F.HOUR);
    const full = F.collect(s, mine.i, T0 + 3 * F.HOUR); // storage is full: nothing comes in
    s.r.gold -= 100;
    const got = F.collect(s, mine.i, T0 + 3 * F.HOUR), left = F.made(mine, T0 + 3 * F.HOUR);
    s.r.grain = 2500;
    const up = F.upgrade(s, mine.i, T0 + 4 * F.HOUR), during = F.made(mine, T0 + 4 * F.HOUR + 30e3), done = F.KINDS.mine.time[1] * 1000 + 1e3;
    F.tick(s, T0 + 4 * F.HOUR + done);
    const after = mine.l === 2 && F.made(mine, T0 + 5 * F.HOUR + done) === 35;
    const day = F.KINDS.mine.hold === 24 && F.KINDS.farm.hold === 24 && F.stat('farm', 1).hold === 480;
    const ok = day && cap.gold === 2500 && cap.grain === 2500 && moved.gold === 2500 && pend.gold === 9000 && m3 === 60 && m30 === 480 && full === 0 && got === 60 && left === 0
      && up && during === 0 && after;
    return {pass: ok, detail: `holds a day’s ${day}; cap ${JSON.stringify(cap)}, moved ${moved.gold}, waiting ${pend.gold}; mine 3h ${m3}, 30h ${m30}; full ${full}, then ${got} (left ${left}); upgrading ${up}, digging ${during}; after ${after}`};
  });

  check('Keepfall: one builder, one job at a time (the owner, Oct 2026): while anything’s going up or being upgraded nothing else can be, walls included (a new wall still goes up at once); no more huts, and a save with two is still one builder; the Castle’s level caps how many of each and how high (one gold mine at level 1, a ballista past level 2 needs Castle 2)', () => {
    const s = F.fresh(T0);
    s.r.gold = 2500; s.r.grain = 2500;
    const v = F.spotFor(s, 'treasury'), built = F.build(s, 'treasury', v.x, v.y, T0);
    const first = built && built.l, busy = F.canBuild(s, 'granary', T0).why, hut = F.canBuild(s, 'hut', T0).why;
    const o = F.spotFor(s, 'hut');
    s.b.push({i: s.nb++, t: 'hut', l: 1, x: o.x, y: o.y, u: 0});
    const two = F.builders(s, T0), still = F.canBuild(s, 'granary', T0).why;
    const mine = F.canBuild(s, 'mine', T0).why;
    const bal = s.b.find(b => b.t === 'ballista');
    bal.l = 2;
    const gate = F.canUpgrade(s, bal.i, T0).why;
    const wall = F.canBuild(s, 'wall', T0).why;
    s.b.find(b => b.t === 'keep').l = 2;
    s.r.gold = 99999;
    const f = F.spotFor(s, 'wall'), wb = F.build(s, 'wall', f.x, f.y, T0), wUp = F.canUpgrade(s, wb ? wb.i : -1, T0).why;
    const done = T0 + F.KINDS.treasury.time[0] * 1000;
    F.tick(s, done);
    const balUp = F.upgrade(s, bal.i, done), after = [F.canUpgrade(s, wb ? wb.i : -1, done).why, F.canUpgrade(s, built.i, done).why, F.canBuild(s, 'granary', done).why];
    const ok = !!built && first === 0 && busy === 'Your builder is busy' && hut === 'One builder does it all' && two.total === 1 && two.free === 0 && still === busy
      && /Castle level 2/.test(mine) && /Castle level 2/.test(gate) && /Castle level 2/.test(wall) && !!wb && wb.l === 1 && wb.u === 0 && wUp === busy
      && built.l === 1 && balUp && after.every(w => w === busy);
    return {pass: ok, detail: `treasury ${!!built}; then: ${busy}; a hut: ${hut}; with 2 huts builders ${JSON.stringify(two)}, a cellar: ${still}; mine: ${mine}; ballista 3: ${gate}; wall at 1: ${wall}; at 2: ${wb ? 'up at once' : 'no'}, its upgrade: ${wUp}; the treasury up ${built.l === 1}, the ballista upgraded ${balUp}, then: ${after.join(' / ')}`};
  });

  check('Keepfall: upgrades take time (the owner, Oct 2026): every level past the first takes longer than the one before (minutes at first, a day or two at the top); the Castle isn’t a level higher till its time’s up, and its builder’s busy till then; a wall’s upgrade takes time too (an hour or few at the top), the builder’s whole time', () => {
    const slow = F.ORDER.filter(k => k !== 'hut' && F.KINDS[k].time.slice(1).some((t, i, a) => t < 60 || (i && t <= a[i - 1])));
    const tops = F.ORDER.filter(k => k !== 'hut' && k !== 'wall').map(k => F.KINDS[k].time[F.maxLevel(k) - 1]);
    const s = F.fresh(T0), keep = s.b.find(b => b.t === 'keep');
    s.r.gold = s.r.grain = 99999;
    const t2 = F.KINDS.keep.time[1] * 1000, up = F.upgrade(s, keep.i, T0), why = F.canUpgrade(s, keep.i, T0 + 1e3).why;
    const free = F.builders(s, T0 + 1e3).free;
    F.tick(s, T0 + t2 - 1e3);
    const early = keep.l;
    F.tick(s, T0 + t2);
    const late = keep.l;
    const f = F.spotFor(s, 'wall'), w = F.build(s, 'wall', f.x, f.y, T0 + t2), m = F.spotFor(s, 'mine');
    const wUp = !!w && F.upgrade(s, w.i, T0 + t2) && F.builders(s, T0 + t2).free === 0, wTime = w ? w.u - (T0 + t2) : 0;
    const busy = F.canBuild(s, 'mine', T0 + t2).why === 'Your builder is busy' && !F.build(s, 'mine', m.x, m.y, T0 + t2);
    F.tick(s, T0 + t2 + wTime);
    const ok = !slow.length && Math.min(...tops) >= 86400 && F.KINDS.wall.time[F.maxLevel('wall') - 1] >= 3600 && up && why === 'Being upgraded' && free === 0 && early === 1 && late === 2
      && !!w && w.l === 2 && busy && wUp && wTime === F.KINDS.wall.time[1] * 1000 && wTime > 0;
    return {pass: ok, detail: `too quick or not longer than the level before: ${slow.join(', ') || 'none'}; quickest top level ${Math.min(...tops) / 3600}h; Castle upgraded ${up} (${why}, ${free} builders free), a second before ${early}, at its time ${late}; a wall upgraded ${wUp}, a mine refused meanwhile ${busy}, ${wTime / 1000}s, then level ${w && w.l}`};
  });

  check('Keepfall: the base: everything stands inside it (EDGE tiles in from the lot’s sides) and nothing overlaps: building or moving onto taken ground, part of it, or off the base is refused, onto clear ground anywhere on it is fine; a save with two on the same ground (or one off the base) is laid out clear when it’s taken up', () => {
    const s = F.fresh(T0), keep = s.b.find(b => b.t === 'keep'), K = F.KINDS.keep.size;
    s.r.gold = s.r.grain = 99999;
    const onKeep = !F.fits(s, 3, keep.x, keep.y) && !F.fits(s, 1, keep.x + K - 1, keep.y + K - 1) && !F.fits(s, 3, keep.x - 2, keep.y - 2);
    const off = !F.fits(s, 1, F.EDGE - 1, F.EDGE) && !F.fits(s, 1, F.N - F.EDGE, F.EDGE) && !F.fits(s, 3, F.EDGE, F.N - F.EDGE - 2);
    const corner = F.fits(s, 1, F.EDGE, F.EDGE) && F.fits(s, 1, F.N - F.EDGE - 1, F.N - F.EDGE - 1);
    const refused = !F.build(s, 'treasury', keep.x + 1, keep.y + 1, T0);
    const t = F.build(s, 'treasury', F.EDGE, F.EDGE, T0), moved = !!t && !F.move(s, t.i, keep.x, keep.y) && F.move(s, t.i, F.N - F.EDGE - F.KINDS.treasury.size, F.EDGE);
    const clear = b => b.every(a => a.x >= F.EDGE && a.y >= F.EDGE && a.x + F.KINDS[a.t].size <= F.N - F.EDGE && a.y + F.KINDS[a.t].size <= F.N - F.EDGE
      && b.every(c => c === a || !(a.x < c.x + F.KINDS[c.t].size && c.x < a.x + F.KINDS[a.t].size && a.y < c.y + F.KINDS[c.t].size && c.y < a.y + F.KINDS[a.t].size)));
    const bad = JSON.parse(JSON.stringify(s));
    bad.b.forEach(b => { if (b.t !== 'keep') { b.x = keep.x; b.y = keep.y; } });
    bad.b.push({i: 999, t: 'wall', l: 1, x: 0, y: 0, u: 0});
    const fixed = F.clean(bad), kept = fixed && fixed.b.length === bad.b.length && clear(fixed.b) && fixed.b.find(b => b.t === 'keep').x === keep.x;
    return {pass: onKeep && off && corner && refused && moved && kept && clear(s.b), detail: `onto the Castle refused ${onKeep}; off the base refused ${off}; its corners fine ${corner}; a build on the Castle refused ${refused}; a move onto it refused, to a clear corner fine ${moved}; a save piled on the Castle and off the base: ${fixed ? `${fixed.b.length} of ${bad.b.length} kept, ${kept ? 'laid out clear, the Castle where it was' : 'NOT clear'}` : 'not taken up'}`};
  });

  check('Keepfall: room for everything (the owner, Oct 2026): the base is big enough that everything the top Castle allows takes up no more than half of it; a new realm and the computer’s are laid out round its middle; a save from the smaller lot (36 tiles) is moved over whole, into the middle of this one, once', () => {
    const B = F.N - 2 * F.EDGE, need = F.ORDER.reduce((t, k) => t + F.COUNT[k][F.MAX_KEEP - 1] * F.KINDS[k].size ** 2, 0);
    const room = need <= B * B / 2;
    const mid = s => { const k = s.b.find(b => b.t === 'keep'); return !!k && k.x + F.KINDS.keep.size / 2 === F.N / 2 && k.y + F.KINDS.keep.size / 2 === F.N / 2; };
    const centred = mid(F.fresh(T0)) && F.BOTS.every(b => mid(F.botBase(b.th)));
    const old = JSON.parse(JSON.stringify(F.fresh(T0))), by = (F.N - 36) / 2;
    delete old.n;
    old.b.forEach(b => { b.x -= by; b.y -= by; });
    const got = F.clean(old), again = got && F.clean(got);
    const moved = !!got && got.n === F.N && got.b.every((b, i) => b.x === old.b[i].x + by && b.y === old.b[i].y + by) && mid(got) && JSON.stringify(again) === JSON.stringify(got);
    return {pass: room && centred && moved, detail: `the base ${B}×${B} (${B * B} tiles), the top Castle’s lot ${need} (${Math.round(need / B / B * 100)}%); laid out round the middle ${centred}; an old save moved ${by} over, once ${moved}`};
  });

  check('Keepfall: the lands (Oct 2026): a realm starts on the coast; Christmas Kingdom is available to Evan at Castle 1 only; raising the Castle unlocks the Enchanted Forest (level 2), the Frozen Tundra (3), the Ocean Sanctuary (5), the Amber Desert (6) and the Infernal Wastes (7); scenery choices persist, can return to the coast, and unavailable choices fall back safely', () => {
    const s = F.fresh(T0), keep = s.b.find(b => b.t === 'keep'), owner = !!data.isOwner();
    const start = F.sceneryOf(s) === 'coast' && F.SCENERIES.filter(x => F.sceneryOpen(s, x.k)).map(x => x.k).sort().join() === (owner ? 'christmas,coast' : 'coast');
    const early = !F.pickScenery(s, 'tundra') && F.sceneryOf(s) === 'coast';
    const at = {};
    for (let l = 1; l <= F.MAX_KEEP; l++) { keep.l = l; F.SCENERIES.forEach(x => { if (at[x.k] == null && F.sceneryOpen(s, x.k)) at[x.k] = l; }); }
    const levels = at.coast === 1 && at.forest === 2 && at.tundra === 3 && at.ocean === 5 && at.desert === 6 && at.infernal === 7 && (owner ? at.christmas === 1 : at.christmas == null);
    keep.l = 5;
    const picked = F.pickScenery(s, 'ocean') && F.sceneryOf(s) === 'ocean' && !F.pickScenery(s, 'infernal') && F.sceneryOf(s) === 'ocean';
    const kept = F.sceneryOf(F.clean(JSON.parse(JSON.stringify(s)))) === 'ocean';
    const low = F.clean(Object.assign(JSON.parse(JSON.stringify(s)), {sc: 'infernal'})), junk = F.clean(Object.assign(JSON.parse(JSON.stringify(s)), {sc: 'moon'}));
    const fallback = F.sceneryOf(low) === 'coast' && junk.sc === '' && F.sceneryOf(junk) === 'coast';
    const back = F.pickScenery(s, 'coast') && F.sceneryOf(s) === 'coast' && s.sc === '';
    const holiday = F.fresh(T0), christmasPick = F.pickScenery(holiday, 'christmas');
    const holidaySave = F.clean({...F.fresh(T0), sc: 'christmas'});
    const christmas = owner
      ? christmasPick && F.keepOf(holiday) === 1 && F.sceneryOf(holiday) === 'christmas' && F.sceneryOf(F.clean(JSON.parse(JSON.stringify(holiday)))) === 'christmas'
        && F.pickScenery(holiday, 'coast') && holiday.sc === '' && F.sceneryOf(holiday) === 'coast'
      : !christmasPick && F.sceneryOf(holiday) === 'coast' && F.sceneryOf(holidaySave) === 'coast';
    return {pass: start && early && levels && picked && kept && fallback && back && christmas, detail: `starts on the coast ${start}; the tundra at Castle 1 refused ${early}; unlocked at ${JSON.stringify(at)}; at Castle 5 the ocean picked, the wastes refused ${picked}; kept in the save ${kept}; a pick not open (or unknown) on the coast ${fallback}; back to the coast ${back}; Christmas selection/persistence/owner restriction ${christmas}`};
  });

  check('Keepfall: the army trains one at a time with Ale (a footman 5 s at one barracks), into the war camps’ room; a full camp takes no more; one taken out of training gives its Ale back', () => {
    const s = F.fresh(T0);
    s.b.push({i: 50, t: 'barracks', l: 1, x: 3, y: 3, u: 0}, {i: 51, t: 'camp', l: 1, x: 3, y: 9, u: 0});
    s.r.grain = 2500;
    const ok20 = F.train(s, 'footman', 20, T0), more = F.canTrain(s, 'footman').why, archerLocked = F.canTrain(s, 'archer').why;
    F.tick(s, T0 + 61e3);
    const at60 = s.ar.footman;
    const grain = s.r.grain;
    F.untrain(s, 'footman', T0 + 61e3);
    const back = s.r.grain - grain;
    F.tick(s, T0 + 200e3);
    const ok = ok20 && /full/.test(more) && /level 2/.test(archerLocked) && at60 === 12 && back === 25 && s.ar.footman === 19 && !s.q.length;
    return {pass: ok, detail: `20 in ${ok20}; 21st: ${more}; archer: ${archerLocked}; after 60 s ${at60}; one out +${back}; in the end ${s.ar.footman}`};
  });

  check('Keepfall: an attack plays out the same every time from the same drops; 20 footmen sack the computer’s first realm (three stars, all it holds), one alone does little; no one can be sent onto or next to a building', () => {
    const base = F.botBase(1), loot = F.botLoot(F.BOTS[0], base, null, T0), box = F.boxOf(base);
    const B = makeBattle(base, loot, {footman: 20});
    for (let i = 0; i < 20; i++) B.deploy('footman', box.x0 - 1.5, box.y0 + i * .8);
    B.run(F.RAID_S);
    const R = replay(base, loot, {footman: 20}, B.result().drops);
    const same = JSON.stringify(R.result()) === JSON.stringify(B.result());
    const one = makeBattle(base, loot, {footman: 1});
    one.deploy('footman', box.x0 - 1.5, box.y0);
    one.run(F.RAID_S);
    const keep = base.b.find(b => b.t === 'keep'), nb = makeBattle(base, loot, {footman: 1}), blocked = !nb.canDrop(keep.x + 1, keep.y + 1) && !nb.deploy('footman', keep.x - .5, keep.y + 1) && nb.canDrop(1, 1);
    const ok = B.stars() === 3 && B.got.gold === F.BOT_LOOT[0] && B.got.grain === F.BOT_LOOT[0] && same && one.stars() === 0 && one.pct() < 50 && blocked;
    return {pass: ok, detail: `20: ${B.stars()} stars ${B.pct()}% take ${JSON.stringify(B.got)} in ${B.t.toFixed(0)} s; replay same ${same}; one: ${one.stars()} stars ${one.pct()}%; next to the Castle refused ${blocked}`};
  });

  check('Keepfall: a dragon flies over the walls (it never stops to break one) and the trebuchet and pitch cauldron can’t touch it, though they hit a knight; a ballista can', () => {
    const b = [{i: 1, t: 'keep', l: 1, x: 16, y: 16, u: 0}, {i: 2, t: 'trebuchet', l: 1, x: 9, y: 17, u: 0}, {i: 3, t: 'cauldron', l: 1, x: 25, y: 17, u: 0}];
    let i = 10;
    for (let d = 13; d <= 23; d++) [[d, 13], [d, 23], [13, d], [23, d]].forEach(([x, y]) => { if (!b.some(q => q.t === 'wall' && q.x === x && q.y === y)) b.push({i: i++, t: 'wall', l: 2, x, y, u: 0}); });
    const base = {b};
    const A = makeBattle(base, null, {dragon: 1}), drake = A.deploy('dragon', 16, 4);
    A.run(F.RAID_S);
    const walls = A.bl.filter(q => q.wall), wallsWhole = walls.every(q => !q.dead && q.hp === q.max);
    const flew = !!drake && !drake.dead && drake.hp === drake.max && A.stars() === 3 && wallsWhole;
    const K = makeBattle(base, null, {knight: 1}), knight = K.deploy('knight', 31, 18);
    K.run(40);
    const hitKnight = !!knight && knight.hp < knight.max;
    const withBallista = {b: b.concat({i: 4, t: 'ballista', l: 1, x: 20, y: 20, u: 0})};
    const C = makeBattle(withBallista, null, {dragon: 1}), d2 = C.deploy('dragon', 16, 4);
    C.run(F.RAID_S);
    const shot = !!d2 && d2.hp < d2.max;
    return {pass: flew && hitKnight && shot, detail: `no ballista: dragon ${drake ? `${drake.hp}/${drake.max}` : 'not sent'}, ${A.stars()} stars, ${walls.length} walls whole ${wallsWhole}; the knight ${knight ? `${knight.hp}/${knight.max}` : 'not sent'}; with a ballista: dragon ${d2 ? `${Math.round(d2.hp)}/${d2.max}` : 'not sent'}`};
  });

  check('Keepfall: the cannon and the dragon hatchery (Oct 2026): a cannon’s crew hits a footman but never a dragon; a dragon trains only with a hatchery, a level of it each dragon’s room; a cannon saved now stays a cannon (only an old Franchise save’s cannons are ballistas)', () => {
    const base = {b: [{i: 1, t: 'keep', l: 1, x: 16, y: 16, u: 0}, {i: 2, t: 'cannon', l: 1, x: 10, y: 17, u: 0}]};
    const A = makeBattle(base, null, {footman: 1}), man = A.deploy('footman', 4, 18);
    A.run(20);
    const D = makeBattle(base, null, {dragon: 1}), drake = D.deploy('dragon', 4, 18);
    D.run(F.RAID_S);
    const fires = !!man && man.hp < man.max && !!drake && drake.hp === drake.max && D.shots.every(x => x.k !== 'cannon');
    const s = F.fresh(T0);
    s.b.push({i: 50, t: 'barracks', l: 6, x: 3, y: 3, u: 0}, {i: 51, t: 'camp', l: 6, x: 3, y: 9, u: 0});
    s.r.grain = 100000;
    const none = F.canTrain(s, 'dragon').why;
    s.b.push({i: 52, t: 'hatchery', l: 1, x: 27, y: 27, u: 0});
    const one = F.canTrain(s, 'dragon').ok && F.train(s, 'dragon', 1, T0), full = F.canTrain(s, 'dragon').why;
    s.b.find(b => b.i === 52).l = 3;
    const room = F.hatchRoom(s) === 3 && F.canTrain(s, 'dragon', 2).ok && !F.canTrain(s, 'dragon', 3).ok;
    const hatch = /hatchery/.test(none) && one && /full/.test(full) && room;
    const kept = F.clean(Object.assign(F.fresh(T0), {b: F.fresh(T0).b.concat({i: 9, t: 'cannon', l: 2, x: 3, y: 3, u: 0})}));
    const stays = !!kept && kept.b.some(b => b.t === 'cannon' && b.l === 2);
    const bots = F.botBase(6).b.some(b => b.t === 'hatchery') && F.botBase(1).b.some(b => b.t === 'cannon');
    return {pass: fires && hatch && stays && bots, detail: `cannon: the footman ${man ? `${man.hp}/${man.max}` : 'not sent'}, the dragon ${drake ? `${drake.hp}/${drake.max}` : 'not sent'}; no hatchery: ${none}; one at level 1: ${one}, then ${full}; level 3 room for 3: ${room}; a cannon kept ${stays}; the computer’s realms have them ${bots}`};
  });

  check('Keepfall: every building level has unique growing artwork and all villagers and tower platforms remain intact', async () => {
    const S = await import('../views/realm-sprites.js'), bad = [];
    const kinds = F.ORDER.filter(k => k !== 'wall');
    if (kinds.some(k => !S.KINDS.includes(k)) || S.KINDS.length !== kinds.length) bad.push('missing family');
    kinds.forEach(k => {
      const fam = S.BUILD[k], fr = fam && fam.f, count = F.maxLevel(k), used = new Set();
      let previous = {width: 0, height: 0, baseWidth: 0};
      if (!fr || fr.length !== count) { bad.push(k + ' frame count'); return; }
      for (let l = 1; l <= count; l++) {
        const f = fr[S.frameOf(k, l)], d = S.dimensionsOf(k, l);
        used.add(f.slice(0, 4).join(':'));
        if (d.baseWidth <= previous.baseWidth || d.width <= previous.width || d.height <= previous.height || f.length !== 7 || f[2] < 30 || f[3] < 30 || f[6] <= 0 || f[0] < 0 || f[1] < 0 || f[0] + f[2] > fam.w || f[1] + f[3] > fam.h) bad.push(k + ' level ' + l);
        previous = d;
      }
      if (used.size !== count) bad.push(k + ' repeated frame');
    });
    const sheets = new Set();
    F.ORDER.forEach(k => { for (let l = 1; l <= F.maxLevel(k); l++) ['ok', 'up'].forEach(st => S.crewOf({i: 1, t: k, l}, st, F.KINDS[k].size).forEach(c => sheets.add(c.sheet))); });
    const missing = [...sheets].filter(n => !S.FOLK[n] || ![4, 8].includes(S.FOLK[n].length));
    const plat = Array.from({length: F.maxLevel('tower')}, (_, i) => S.platform(i + 1)).every((p, i) => p && p[0] > 0 && p[0] < S.BUILD.tower.f[i][2] && p[1] > 0 && p[1] < S.BUILD.tower.f[i][3]);
    const paths = kinds.map(k => 'upgrades-v1/' + k + '.webp').concat('folk.webp');
    const files = data.isOwner() ? await Promise.all(paths.map(n => fetch(new URL('../../img/realm/' + n, import.meta.url), {method: 'HEAD'}).then(r => r.ok ? '' : n, () => n))) : [];
    const gone = files.filter(Boolean);
    return {pass: !bad.length && !missing.length && plat && !gone.length && sheets.size >= 20, detail: JSON.stringify({bad, missing, plat, gone, families:kinds.length})};
  });

  check('Keepfall: the scenery (tools/realm/sceneries.py; img/realm/scenery/: every land a blank portrait landscape, the owner’s, Oct 2026, and its village round the lot, tools/realm/village.py): every land has its layout, tall, and its landscape and every picture placed on it are there; nothing’s placed in its build zone, its lot lies inside it, and the zone inside the landscape', async () => {
    const D3 = await import('../views/realm-3d.js'), out = [];
    let pass = F.SCENERIES.every(x => D3.FILES[x.k] && D3.FILES[x.k].tall);
    for (const [shape, file] of Object.entries(D3.FILES).flatMap(([k, f]) => Object.entries(f).map(([sh, fl]) => [`${k} ${sh}`, fl]))) {
      const lay = await fetch(new URL(`../../img/realm/scenery/${file}`, import.meta.url)).then(r => r.json(), () => null);
      if (!lay) { pass = false; out.push(`${shape}: no layout`); continue; }
      const A = lay.assets, bg = lay.scene.background_asset_id, Z = lay.build_zone_polygon, L = lay.lot && D3.sceneryLot(lay.lot);
      const unknown = lay.instances.filter(it => !A[it.asset_id] || it.asset_id === bg).map(it => it.id);
      const files = await Promise.all(Object.values(A).map(a => fetch(new URL(`../../img/realm/scenery/${a.pic && a.pic.file}`, import.meta.url), {method: 'HEAD'}).then(r => r.ok ? '' : a.file, () => a.file)));
      const gone = files.filter(Boolean);
      // (the zone is convex: a point's inside when it's on the same side of every edge)
      const inZone = ([x, y]) => { const sd = Z.map((p, i) => { const q = Z[(i + 1) % Z.length]; return Math.sign((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])); }).filter(Boolean); return sd.every(v => v === sd[0]); };
      const inside = lay.instances.filter(it => inZone([it.rect.x + it.rect.width / 2, it.rect.y + it.rect.height])).map(it => it.id);
      const hh = L ? L.h / 2 : 0, hw = hh / Math.sin(D3.PITCH);
      const lot = !!L && [[L.cx - hw, L.cy], [L.cx, L.cy - hh], [L.cx + hw, L.cy], [L.cx, L.cy + hh]].every(inZone);
      const S = lay.scene, onIt = !!S && S.height > S.width && Z.every(([x, y]) => x >= 0 && y >= 0 && x <= S.width && y <= S.height);
      pass = pass && !unknown.length && !gone.length && !inside.length && lot && onIt;
      out.push(`${shape}: ${lay.instances.length} placed${unknown.length ? `, unknown pictures: ${unknown.join(', ')}` : ''}; ${gone.length ? 'missing: ' + gone.join(', ') : 'all there'}; in the build zone: ${inside.length ? inside.join(', ') : 'nothing'}; the lot ${lot ? 'inside it' : 'NOT inside it'}; ${onIt ? 'portrait, the zone on it' : 'NOT portrait with the zone on it'}`);
    }
    return {pass, detail: out.join(' · ')};
  });

  check('Keepfall: the army’s pictures (tools/realm/army.py, img/realm/army/): the Footman, Archer, Knight, Thief and Dragon each drawn from his (where he stands inside it, a way he faces, a size: the Dragon bigger than any man, and in the air); the pictures are there', async () => {
    const meta = await fetch(new URL('../../img/realm/army/army.json', import.meta.url)).then(r => r.json(), () => null);
    if (!meta) return {pass: false, detail: 'no army.json'};
    const want = F.TROOP_ORDER, bad = want.filter(t => { const m = meta[t]; return !m || !(m.w > 50 && m.h > 50) || !(m.ax >= 0 && m.ax <= m.w && m.ay >= 0 && m.ay <= m.h) || typeof m.right !== 'boolean' || !(m.fly ? m.wide > 0 : m.tall > 0); });
    const files = await Promise.all(want.map(t => fetch(new URL(`../../img/realm/army/${t}.webp`, import.meta.url), {method: 'HEAD'}).then(r => (r.ok ? '' : t), () => t)));
    const gone = files.filter(Boolean), men = want.filter(t => t !== 'dragon').map(t => meta[t] && meta[t].tall * meta[t].w / meta[t].h);
    const big = !!meta.dragon && meta.dragon.fly && meta.dragon.wide > Math.max(...men) * 2 && men.every(w => w > 0);
    const pass = !bad.length && !gone.length && !meta.sapper && big && want.every(t => !meta[t] || !!meta[t].fly === !!F.TROOPS[t].fly);
    return {pass, detail: `${bad.length ? 'wrong: ' + bad.join(', ') : want.join(', ') + ' ok'}; the dragon ${big ? 'bigger, flying' : 'WRONG'}; ${gone.length ? 'missing: ' + gone.join(', ') : 'pictures there'}`};
  });

  check('Keepfall: the computer’s realms raid his realm (at most one each half day, the last two while he was away; none in its first day, before Castle level 3 (Oct 22 2026, was 2) or during a truce): played the same every time, taken off his stores and glory once, never his coffers', () => {
    const born = T0 - 3 * DAY;
    const small = F.fresh(born), none = defend(small, T0), two = F.fresh(born);
    two.b.find(b => b.t === 'keep').l = 2;
    const skipped = !none.length && small.lr === T0 && !defend(two, T0).length && two.lr === T0 && !two.df.length && F.DEFEND_AT === 3;
    const s = F.fresh(born);
    s.b.find(b => b.t === 'keep').l = 3;
    s.r = {gold: 4000, grain: 4000};
    s.tp = 100;
    const before = JSON.parse(JSON.stringify(s)), due = raidsDue(s, T0), coffers = JSON.stringify(F.pending(s, 5000));
    const done = defend(s, T0), again = defend(s, T0);
    const twin = defend(F.clean(before), T0);
    const same = JSON.stringify(twin) === JSON.stringify(done);
    const took = done.reduce((a, r) => [a[0] + r.ls[0], a[1] + r.ls[1]], [0, 0]);
    const stores = s.r.gold === Math.max(0, 4000 - took[0]) && s.r.grain === Math.max(0, 4000 - took[1]);
    const glory = s.tp === Math.max(0, 100 + done.reduce((a, r) => a + r.td, 0));
    const truced = done.some(r => r.st > 0) ? s.sh > 0 : true;
    const ok1 = due.length >= 1 && due.length <= 2 && done.length >= 1 && done.length <= due.length && done.every(r => due.includes(r.at) && r.by && Array.isArray(r.lt))
      && !again.length && s.lr === due[due.length - 1] && s.df.length === done.length && JSON.stringify(F.pending(s, 5000)) === coffers && same && stores && glory && truced;
    const young = F.fresh(T0 - 12 * F.HOUR);
    young.b.find(b => b.t === 'keep').l = 3;
    const firstDay = raidsDue(young, T0).length === 0;
    const calm = F.clean(before);
    calm.sh = T0 + F.HOUR;
    const inTruce = !defend(calm, T0).length && calm.lr === due[due.length - 1];
    return {pass: ok1 && skipped && firstDay && inTruce, detail: `Castle 1 and 2: none ${skipped}; due ${due.length}, played ${done.length} (${done.map(r => `${r.by} ${r.st}★ ${r.pc}% took ${r.lt.join('/')}`).join('; ')}), again ${again.length}; the same twice ${same}; stores ${JSON.stringify(s.r)} ok ${stores}; glory ${s.tp} ok ${glory}; truce ${truced}; coffers untouched ${JSON.stringify(F.pending(s, 5000)) === coffers}; first day none ${firstDay}; in a truce none ${inTruce}`};
  });

  // ---- the batch of Oct 22 2026: competitive pay, Castle 4 unlocks, raid replays and example raids
  check('Keepfall: the competitive pay’s numbers (the owner, Oct 22 2026: package C): Kick It 500 for the counting run and 3,000 for every 5th make (40 makes at most: 24,500), Return Man 500 a day with a run and 25 a coin, the first 200; Ale by place as it was; a raid on his realm takes a tenth of what’s stored (was .15) and a quarter of the mines’ and breweries’ piles (was half), which hold a day’s output (24 hours, was 10)', async () => {
    const kickTable = Array.from({length: 41}, (_, m) => m).filter(m => F.kickGold(m) !== 500 + 3000 * Math.floor(m / 5) || (typeof kk.goldOf === 'function' && kk.goldOf(m) !== F.kickGold(m)));
    const kick = !kickTable.length && F.kickGold(40) === 24500 && F.kickGold(45) === 24500 && F.KICK_GOLD === 3000 && F.KICK_BASE === 500 && F.KICK_EVERY === 5;
    const coins = [0, 1, 12, 84, 199, 200, 201, 1000], retTable = coins.filter(c => F.returnGold(c) !== 500 + 25 * Math.min(c, 200));
    const ret = !retTable.length && F.COIN_GOLD === 25 && F.RETURN_BASE === 500 && F.COIN_PAID_MAX === 200 && F.COIN_MAX === 1000 && F.returnGold(1000) === 5500;
    const ale = F.ALE_BY_PLACE.join() === '5000,4000,3200,2600,2100,1700,1200' && JSON.stringify(F.NEW_PAY) === JSON.stringify({puzzles: 25, '17-0': 14, drill: 8, kick: 5, return: 3});
    const shares = F.STORE_SHARE === .1 && F.MADE_SHARE === .25 && F.KINDS.mine.hold === 24 && F.KINDS.farm.hold === 24;
    // (a new realm, 10,000 Gold and 8,000 Ale stored, its mine and brewery ten hours full: 200 each)
    const s = F.fresh(T0);
    s.r = {gold: 10000, grain: 8000};
    const L = F.lootOf(s, T0 + 10 * F.HOUR);
    const loot = L.total.gold === 1000 + 50 && L.total.grain === 800 + 50;
    return {pass: kick && ret && ale && shares && loot, detail: `Kick It ${[0, 4, 5, 10, 25, 40].map(m => `${m}: ${F.kickGold(m)}`).join(', ')}${kickTable.length ? ' (wrong at ' + kickTable.join(',') + ')' : ''} ${kick}; Return Man ${coins.map(c => `${c}: ${F.returnGold(c)}`).join(', ')} ${ret}; Ale ${F.ALE_BY_PLACE.join('/')} ${ale}; shares ${F.STORE_SHARE}/${F.MADE_SHARE}, hold ${F.KINDS.mine.hold}h ${shares}; a raid’s take on 10,000/8,000 stored and 200/200 piled: ${JSON.stringify(L.total)} ${loot}`};
  });

  check('Keepfall: Castle 4 unlocks (the owner, Oct 22 2026): attacking and scouting the computer’s realms open at Castle level 4 (before then “Raids open at Castle level 4”), and then only realms up to a level above his Castle (the rest “Castle level N”: scouting them is fine); the Knight Hero is recruited from Castle 4 like the Wizard (one recruited before keeps his level); the computer raids him from Castle 3 (Oct 22 2026, was 2)', () => {
    const at = l => { const s = F.fresh(T0 - 3 * DAY); s.b.find(b => b.t === 'keep').l = l; s.r = {gold: 99999, grain: 99999}; return s; };
    const open = [1, 2, 3, 4, 5, 6, 7, 8].map(l => F.attackOpen(at(l))).join() === 'false,false,false,true,true,true,true,true' && F.ATTACK_AT === 4;
    const reach = l => F.BOTS.filter(b => F.canTarget(at(l), b)).map(b => b.th).join('');
    const targets = reach(3) === '' && reach(4) === '12345' && reach(5) === '123456' && reach(7) === '12345678' && F.canTarget(at(4), 'bot:5') && !F.canTarget(at(4), 'bot:9');
    const whys = [F.attackWhy(at(3), 'bot:1'), F.attackWhy(at(4), 'bot:6'), F.attackWhy(at(4), 'bot:8'), F.attackWhy(at(4), 'bot:5'), F.attackWhy(at(4), 'bot:8', {scout: true}), F.attackWhy(at(2), 'bot:1', {scout: true})];
    const words = JSON.stringify(whys) === JSON.stringify(['Raids open at Castle level 4', 'Castle level 5', 'Castle level 7', '', '', 'Raids open at Castle level 4']) && F.targetAt('bot:2') === 4 && F.targetAt('bot:8') === 7;
    const r3 = F.realmOf('bot:1', at(3), T0), r6 = F.realmOf('bot:6', at(4), T0), sc6 = F.realmOf('bot:6', at(4), T0, {scout: true}), any = F.realmOf('bot:8', null, T0);
    const realms = r3.locked && r3.why === 'Raids open at Castle level 4' && r6.locked && r6.why === 'Castle level 5' && !sc6.why && sc6.th === 6 && !any.why && any.th === 8;
    const owner = !!data.isOwner();
    const k3 = F.canRecruitHero(at(3), 'knight'), k4 = F.canRecruitHero(at(4), 'knight'), w3 = F.canRecruitHero(at(3), 'wizard');
    const heroes = F.HEROES.knight.at === 4 && F.HEROES.wizard.at === 4
      && (owner ? k3.why === 'Needs Castle level 4' && w3.why === 'Needs Castle level 4' && k4.ok : !k3.ok && !k4.ok && /Evan/.test(k4.why));
    const had = Object.assign(at(2), {hr: {knight: 2}}), kept = F.clean(JSON.parse(JSON.stringify(had)));
    const stays = !!kept && kept.hr.knight === 2 && F.heroLevel(kept, 'knight') === 2 && (owner ? F.heroLevels(kept).knight === 2 : true);
    const raided = defend(at(3), T0).length >= 1 && !defend(at(2), T0).length && !defend(at(1), T0).length;
    return {pass: open && targets && words && realms && heroes && stays && raided, detail: `open from Castle 4 ${open}; in reach at Castle 3/4/5/7: ${reach(3) || 'none'}/${reach(4)}/${reach(5)}/${reach(7)} ${targets}; why ${JSON.stringify(whys)} ${words}; realmOf refuses ${realms}; heroes at ${F.HEROES.knight.at}/${F.HEROES.wizard.at}, the Knight Hero at Castle 3: ${k3.why}, at 4: ${k4.ok || k4.why} ${heroes}; one recruited at Castle 2 stays ${stays}; raided from Castle 3, not 2 ${raided}`};
  });

  check('Keepfall: raids on him start at Castle 3 (the owner, Oct 22 2026, was 2; DEFEND_AT): the screens say so (the Chronicle of a smaller realm “Once your Castle is level 3”, Attack’s lock “start at Castle level 3”, the welcome “once your Castle is level 3”), never level 2; the example raids aren’t held to it (a Castle 2 realm still gets its three to watch, on his phone)', async () => {
    const view = await import('../views/realm.js');
    const at = l => { const s = F.fresh(T0 - 3 * DAY); s.b.find(b => b.t === 'keep').l = l; return s; };
    const words = (s, w) => { const t = document.createElement('template'); t.innerHTML = ((view._screens(s, T0) || []).find(p => p.where === w) || {}).html || ''; return t.content.textContent.replace(/\s+/g, ' '); };
    const log2 = words(at(2), 'The Chronicle'), log3 = words(at(3), 'The Chronicle'), atk = words(at(2), 'Attack'), hi = words(at(2), 'Keepfall');
    const said = F.DEFEND_AT === 3 && log2.includes('Once your Castle is level 3, the computer’s realms will start raiding you') && log3.includes('No one has raided you yet.')
      && atk.includes('Their raids on you start at Castle level 3 all the same') && hi.includes('once your Castle is level 3, those realms raid you too')
      && !/(once your Castle is|start at Castle) level 2\b/i.test(log2 + atk + hi);
    const src = await fetch(new URL('./realm-battle.js', import.meta.url)).then(r => r.text()).catch(() => '');
    const gate = /if \(keepOf\(s\) < DEFEND_AT\) \{ s\.lr = Math\.max\(s\.lr \|\| 0, now\); return \[\]; \}/.test(src);
    // (the examples: on his phone, three on a Castle 2 realm as on any other; nothing on anyone else's)
    const owner = !!data.isOwner(), two = at(2), ex = exampleRaids(two, T0);
    const examples = owner ? ex.length >= 1 && (two.ex || []).length === ex.length && !two.df.length : !ex.length;
    return {pass: said && gate && examples, detail: `the words ${said}; defend’s gate ${gate}; example raids on a Castle 2 realm: ${ex.map(r => `${r.st}★`).join(' ') || 'none'} ${examples}`};
  });

  check('Keepfall: the computer’s raids come at an hour that moves from day to day, the same on every phone (Oct 22 2026: they’d come at about 05:26 and 17:26 every day), one in each half of the day', () => {
    const days = Array.from({length: 14}, (_, d) => { const t = new Date(2026, 9, 1 + d).getTime(); return raidsDue({lr: t, born: 0}, t + DAY - 1); });
    const twice = Array.from({length: 14}, (_, d) => { const t = new Date(2026, 9, 1 + d).getTime(); return raidsDue({lr: t, born: 0}, t + DAY - 1); });
    const hm = t => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60; };
    const am = days.map(x => x[0]).filter(Boolean).map(hm), pm = days.map(x => x[1]).filter(Boolean).map(hm);
    const halves = days.every(x => x.length === 2) && am.every(h => h >= 1 && h <= 11) && pm.every(h => h >= 13 && h <= 23);
    const spread = new Set(am.map(Math.floor)).size >= 5 && new Set(pm.map(Math.floor)).size >= 5 && Math.max(...am) - Math.min(...am) >= 4 && Math.max(...pm) - Math.min(...pm) >= 4;
    const same = JSON.stringify(days) === JSON.stringify(twice);
    const fmt = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round(h % 1 * 60)).padStart(2, '0')}`;
    return {pass: halves && spread && same, detail: `mornings ${am.map(fmt).join(' ')}; evenings ${pm.map(fmt).join(' ')}; one each half ${halves}; moving ${spread}; the same twice ${same}`};
  });

  // (an attack as views/realm-raid.js plays it: drops at fractions of a tile, the clock run between them, then End)
  const attack = (s, key, army, heroes, endAt) => {
    const T = F.realmOf(key, s, T0), B = makeBattle(T.base, T.loot, army, {heroes}), box = F.boxOf(T.base);
    const send = (t, n, side) => { for (let i = 0; i < n; i++) B.deploy(t, side ? box.x1 + 1.37 : box.x0 - 1.63, box.y0 + .29 + i * .73); };
    send('footman', Math.min(6, army.footman || 0), 0);
    B.run(2.35);
    send('archer', army.archer || 0, 1);
    Object.keys(B.heroes).forEach((k, i) => B.deploy(F.HEROES[k].troop, box.x0 - 2.11, box.y1 - 1.07 - i));
    B.run(7.9);
    send('footman', Math.max(0, (army.footman || 0) - 6), 1);
    send('knight', army.knight || 0, 0);
    B.run(endAt);
    if (!B.over) B.end();
    const r = B.result(), rec = {id: `a${(T0 + endAt).toString(36)}`, vs: T.key, nm: T.name, at: T0, st: r.stars, pc: r.pct, lt: [r.got.gold, r.got.grain], ta: F.gloryFor(r.stars, T.th), hr: r.heroes};
    F.finishRaid(s, rec, r.used, T0, B);
    return {T, B, r, rec};
  };
  const same = (B, rec) => B.stars() === rec.st && B.pct() === rec.pc && B.got.gold === rec.lt[0] && B.got.grain === rec.lt[1];
  const top = () => { const s = F.fresh(T0 - 3 * DAY); s.b.find(b => b.t === 'keep').l = F.MAX_KEEP; s.ar = {footman: 40, archer: 20, knight: 6}; return s; };

  check('Keepfall: raid replays: an attack is recorded with its replay (rp: the realm’s lot as it stood, its take, the army, every drop, the step it ended on, the heroes) and played again from it it’s the same raid: the same stars, % and take, building by building, ended where it ended (End pressed or not), however its clock is run (all at once or a frame at a time, at any speed); the replay draws the lot it was, from the record', () => {
    const owner = !!data.isOwner(), s = top();
    const a = attack(s, 'bot:4', {footman: 14, archer: 8, knight: 2}, owner ? {knight: 3, wizard: 2} : {}, 41.3);
    const b = attack(s, 'bot:1', {footman: 20}, {}, F.RAID_S);
    const out = [a, b].map(({T, B, r, rec}) => {
      const P = F.decodeReplay(rec.rp), mine = F.replayOf(rec);
      if (!P) return {ok: false, why: 'no replay'};
      const R = replayBattle(P);
      R.play(Infinity);
      const one = same(R, rec) && JSON.stringify(R.gotBy) === JSON.stringify(r.gotBy) && R.step === B.step && R.why === B.why && JSON.stringify(R.used) === JSON.stringify(r.used);
      // (a frame at a time, at 4×)
      const S = replayBattle(P);
      let t = 0, guard = 0;
      while (!S.over && guard++ < 5000) { t += .016 * 4 + (guard % 7) * .003; S.play(t); }
      const frames = same(S, rec) && S.step === B.step && Math.abs(S.dur - B.step * .1) < 1e-9;
      const again = replay(P.base, P.loot, P.army, P.drops, Infinity, P.opts), fn = same(again, rec) && again.step === B.step;
      // (the lot it was: every standing building where it stood, at its level, with its take)
      const lot = JSON.stringify(P.base.b.map(x => [x.i, x.t, x.l, x.x, x.y])) === JSON.stringify(T.base.b.filter(x => x.l >= 1).map(x => [x.i, x.t, x.l, x.x, x.y]))
        && Object.entries(T.loot.by).every(([i, v]) => (!v.gold && !v.grain) || JSON.stringify(P.loot.by[i]) === JSON.stringify(v));
      const heroes = JSON.stringify(P.hr) === JSON.stringify(B.heroes) && (owner ? JSON.stringify(mine) === JSON.stringify(P) : mine === null) && F.hasReplay(rec);
      return {ok: one && frames && fn && lot && heroes, why: `${rec.nm}: ${rec.st}★ ${rec.pc}% ${rec.lt.join('/')} (${B.why}, step ${B.step}${Object.keys(B.heroes).length ? ', heroes ' + JSON.stringify(B.heroes) : ''}) → ${R.stars()}★ ${R.pct()}% ${R.got.gold}/${R.got.grain} (${R.why}) same ${one}, frame by frame ${frames}, replay() ${fn}, the lot ${lot}, heroes and owner’s ${heroes}`};
    });
    const kept = s.rd.length === 2 && s.rd.every(r => r.rp);
    return {pass: out.every(o => o.ok) && kept && a.B.why === 'quit' && b.B.why !== 'quit', detail: out.map(o => o.why).join(' · ') + `; on the record ${kept}`};
  });

  check('Keepfall: raid replays: each of the computer’s raids on his realm is recorded with its replay (his lot then, his defending heroes, the computer’s drops as they went in) and plays again the same: the same stars, % and take; it shows the lot as it was even after he’s moved and upgraded since', () => {
    // (Castle 3: the computer raids him from there, Oct 22 2026, was 2)
    const owner = !!data.isOwner(), s = F.fresh(T0 - 3 * DAY);
    s.b.find(b => b.t === 'keep').l = 3;
    s.hr = {knight: 2};
    s.r = {gold: 4000, grain: 4000};
    [['cannon', 1], ['tower', 1], ['wall', 1], ['wall', 1], ['treasury', 2]].forEach(([t, l]) => { const p = F.spotFor(s, t); if (p) s.b.push({i: s.nb++, t, l, x: p.x, y: p.y, u: 0}); });
    const lot = JSON.stringify(s.b.filter(b => b.l >= 1).map(b => [b.i, b.t, b.l, b.x, b.y]));
    const done = defend(s, T0);
    const each = done.map(rec => {
      const P = F.decodeReplay(rec.rp, s), R = P && replayBattle(P);
      if (R) R.play(Infinity);
      return {rec, ok: !!R && same(R, rec) && JSON.stringify(P.base.b.map(b => [b.i, b.t, b.l, b.x, b.y])) === lot && (owner ? P.dh.knight === 2 && R.defenders.length === 1 : !R.defenders.length), R};
    });
    // (since: the cannon moved, the Castle up a level; the replay's lot is the record's)
    const cannon = s.b.find(b => b.t === 'cannon'), spot = cannon && F.spotFor(Object.assign({}, s, {b: s.b.filter(b => b !== cannon)}), 'cannon', {x: 4, y: 4});
    if (spot) F.move(s, cannon.i, spot.x, spot.y);
    s.b.find(b => b.t === 'keep').l = 4;
    const still = done.every(rec => JSON.stringify(F.decodeReplay(rec.rp, s).base.b.map(b => [b.i, b.t, b.l, b.x, b.y])) === lot);
    // (his lot kept once, in the realm's lots, however many raids were played on it)
    const once = !!s.lots && Object.keys(s.lots).length === 1 && done.every(rec => rec.rp.L === Object.keys(s.lots)[0]);
    const ok = done.length >= 1 && each.every(x => x.ok) && still && once && s.df.every(r => r.rp) && JSON.stringify(s.df.map(r => r.id)) === JSON.stringify(done.map(r => r.id));
    return {pass: ok, detail: `${done.length} raids: ${each.map(x => `${x.rec.by} ${x.rec.st}★ ${x.rec.pc}% took ${x.rec.lt.join('/')} → ${x.R ? `${x.R.stars()}★ ${x.R.pct()}% ${x.R.got.gold}/${x.R.got.grain}` : 'no replay'} ${x.ok}`).join('; ')}; the lot as it was after a move and an upgrade ${still}; his lot kept once ${once}`};
  });

  check('Keepfall: raid replays are small on the board (his realm rides on his board doc, which every phone in the league downloads on each save): rp is a few short text fields (the numbers packed, no array or object a building or a drop), a computer’s lot never kept (only which one, checked when played), his own kept once in the realm’s lots whatever number of raids were played on it; a full Castle 8 realm with 10 attacks, 10 raids on him and 3 examples grows by a few KB, not a hundred; kept on the newest 10 of each list, through the save and clean() as it was, the same battle; a broken one has no replay (no ▶) and clean() drops it (and the lots no replay points at); one played under other rules has no ▶ but is kept; the attacks keep their last 40, the raids on him their last 20; the example raids at most 3; a save from before has none and gains no fields', () => {
    const s = top(), base = F.botBase(1), loot = F.botLoot(F.BOTS[0], base, null, T0);
    const battle = n => { const B = makeBattle(base, loot, {footman: 1}); B.deploy('footman', 2.5 + (n % 5) * .1, 3.5); B.run(1); B.end(); return B; };
    for (let n = 0; n < 45; n++) F.finishRaid(s, {id: 'a' + n, vs: 'bot:1', nm: 'Thornfield Hamlet', at: T0 + n, st: 0, pc: 0, lt: [0, 0], ta: 0}, {}, T0 + n, battle(n));
    const rd = s.rd.length === 40 && s.rd.slice(-10).every(r => r.rp) && s.rd.slice(0, -10).every(r => !r.rp) && s.rd[39].id === 'a44';
    for (let n = 0; n < 25; n++) F.takeRaid(s, {id: 'd' + n, at: T0 + n, by: 'Briarwatch', th: 2, st: 0, pc: 0, lt: [0, 0], ls: [0, 0], lb: {}, td: 0, rp: F.snapOf(battle(n))});
    const df = s.df.length === 20 && s.df.slice(-10).every(r => r.rp) && s.df.slice(0, -10).every(r => !r.rp);
    // (short text: a computer's lot by which one it is, the rest packed)
    const rp = s.rd[39].rp, text = v => typeof v === 'string' && /^[A-Za-z0-9_.-]*$/.test(v);
    const flat = rp.v === F.RP_V && text(rp.p) && /^b1\.[0-9a-z]+$/.test(rp.L) && !('b' in rp) && Object.values(rp).every(v => text(v) || Number.isInteger(v)) && !s.lots;
    const size = JSON.stringify(rp).length;
    // (through the save and clean(): as it was, and the same battle)
    const back = F.clean(JSON.parse(JSON.stringify(s)));
    const kept = !!back && JSON.stringify(back.rd) === JSON.stringify(s.rd) && JSON.stringify(back.df) === JSON.stringify(s.df);
    const P = F.decodeReplay(back.rd[39].rp, back), R = replayBattle(P), B0 = battle(44);
    R.play(Infinity);
    const trip = JSON.stringify(R.bl.map(b => [b.i, b.t, b.l, b.x, b.y, b.loot])) === JSON.stringify(B0.bl.map(b => [b.i, b.t, b.l, b.x, b.y, b.loot])) && R.pct() === B0.pct() && R.step === B0.step;
    // (broken: cut short, a character that isn't one, a lot that isn't kept, a lot that isn't one, another format; and
    // played under other rules: no ▶, but kept)
    const bad = [{...rp, p: rp.p.slice(0, 3)}, {...rp, p: rp.p + '!'}, {...rp, L: 'zz9'}, {v: rp.v, bv: rp.bv, p: rp.p, b: 'AQ'}, {...rp, v: 1}, null, 'x'];
    const broken = bad.every(p => F.decodeReplay(p) === null && !F.hasReplay({rp: p}));
    const stale = {...rp, bv: 'older'}, old = F.decodeReplay(stale) === null && !F.hasReplay({rp: stale});
    const junk = F.clean(Object.assign(top(), {rd: [{id: 'a1', vs: 'bot:1', at: T0, rp: bad[0]}, {id: 'a2', vs: 'bot:1', at: T0, rp}, {id: 'a3', vs: 'bot:1', at: T0, rp: stale}],
      ex: [1, 2, 3, 4].map(n => ({id: 'x' + n, at: T0, ex: true, rp})).concat({id: 'x9', at: T0, rp}), exv: 1, lots: {zz1: 'AQ'}}));
    const cleaned = !junk.rd[0].rp && !!junk.rd[1].rp && !!junk.rd[2].rp && junk.ex.length === 3 && junk.ex.every(r => r.ex === true) && junk.ex[2].id === 'x4' && junk.exv === F.EX_V && !('lots' in junk);
    const none = (() => { const o = F.clean(F.fresh(T0)); return !('ex' in o) && !('exv' in o) && !('lots' in o) && JSON.stringify(F.clean(o)) === JSON.stringify(o); })();
    // (the board's database takes no array straight inside another; and a replay has no array or map at all now)
    const nested = v => (Array.isArray(v) ? v.some(x => Array.isArray(x) || nested(x)) : !!v && typeof v === 'object' && Object.values(v).some(nested));
    const ex = top();
    exampleRaids(ex, T0);
    const storable = !nested(s.rd) && !nested(s.df) && !nested(ex.ex || []) && [...s.rd, ...s.df, ...(ex.ex || [])].every(r => !r.rp || Object.values(r.rp).every(v => typeof v !== 'object'));
    // (a full Castle 8 realm, its own lot (no computer's), 225 walls: 10 attacks on the Obsidian Spire, 10 raids on him,
    // the 3 examples; how much the replays add to what's saved)
    const big = top(), B8 = F.botBase(8);
    big.b = B8.b.map(b => Object.assign({}, b, F.KINDS[b.t].role === 'make' ? {c: T0 - 6 * F.HOUR} : {}));
    big.b.find(b => b.t === 'wall').l = 1;
    Object.assign(big, {nb: Math.max(...big.b.map(b => b.i)) + 1, r: {gold: 60000, grain: 60000}, ar: {footman: 40, archer: 30, knight: 8}});
    // (walls up to the Castle 8's 225, in rows round the outside)
    for (let guard = 0; F.countOf(big, 'wall') < F.allowed(big, 'wall') && guard < 400; guard++) { const q = F.spotFor(big, 'wall'); if (!q) break; big.b.push({i: big.nb++, t: 'wall', l: 6, x: q.x, y: q.y, u: 0}); }
    const T8 = F.realmOf('bot:8', null, T0), box8 = F.boxOf(T8.base);
    for (let n = 0; n < 10; n++) {
      const A = makeBattle(T8.base, T8.loot, {footman: 30, archer: 25, knight: 8});
      for (let i = 0; i < 30; i++) A.deploy('footman', box8.x0 - 1.4 - (n % 3) * .3, box8.y0 + i * .55);
      A.run(3); for (let i = 0; i < 25; i++) A.deploy('archer', box8.x1 + 1.6, box8.y0 + i * .6);
      A.run(6); for (let i = 0; i < 8; i++) A.deploy('knight', box8.x0 + i * 1.3, box8.y1 + 1.5);
      A.run(25); A.end();
      F.finishRaid(big, {id: 'a' + n, vs: 'bot:8', nm: T8.name, at: T0 + n, st: A.stars(), pc: A.pct(), lt: [A.got.gold, A.got.grain], ta: 0}, {}, T0 + n, A);
    }
    const mbox = F.boxOf(big);
    for (let n = 0; n < 10; n++) {
      const D = makeBattle(big, F.lootOf(big, T0), raidArmy(8));
      Object.entries(raidArmy(8)).forEach(([t, k]) => { for (let i = 0; i < k; i++) D.deploy(t, mbox.x0 - 1.5, mbox.y0 + (i + n) % 30 * .7); });
      D.run(20); D.end();
      F.takeRaid(big, {id: 'd' + n, at: T0 + n, by: 'Ironvale Citadel', th: 7, st: D.stars(), pc: D.pct(), lt: [D.got.gold, D.got.grain], ls: [0, 0], lb: {}, td: 0, rp: F.snapOf(D, {into: big})});
    }
    exampleRaids(big, T0);
    const bare = JSON.parse(JSON.stringify(big));
    delete bare.ex; delete bare.exv; delete bare.lots;
    [...bare.rd, ...bare.df].forEach(r => { delete r.rp; });
    const full = JSON.stringify(big).length, without = JSON.stringify(bare).length, lots = Object.keys(big.lots || {}), walls = F.countOf(big, 'wall');
    const owner = !!data.isOwner(), bex = big.ex || [];
    const small = big.rd.filter(r => r.rp).length === 10 && big.df.filter(r => r.rp).length === 10 && bex.length === (owner ? 3 : 0) && lots.length === 1
      && [...big.df, ...bex].every(r => r.rp.L === lots[0]) && big.rd.every(r => /^b8\./.test(r.rp.L)) && full - without < 20000 && walls === 225;
    const plays8 = F.decodeReplay(big.df[9].rp, big) && F.decodeReplay(big.rd[9].rp, big) && (!owner || F.decodeReplay(bex[0].rp, big));
    const ok = rd && df && flat && kept && trip && broken && old && cleaned && none && storable && size < 400 && small && !!plays8;
    return {pass: ok, detail: `attacks ${s.rd.length}, replays on ${s.rd.filter(r => r.rp).length} (${rd}); raids on him ${s.df.length}, replays on ${s.df.filter(r => r.rp).length} (${df}); short text ${flat}, ${size} characters; nothing nested ${storable}; through the save ${kept}, the same battle ${trip}; broken ones refused ${broken}; other rules hidden ${old}; clean() ${cleaned}; an old save gains nothing ${none}; Castle 8 with ${big.b.length} buildings, ${walls} of them walls: ${without} characters saved without replays, ${full} with 10 + 10 + 3 (+${full - without}; his lot kept ${lots.length}×, ${lots.map(k => big.lots[k].length).join()} characters) ${small}`};
  });

  check('Keepfall: example raids (the owner’s ask, Oct 22 2026): three of the computer’s raids on his realm as it is, played for real and recorded with replays: one driven off (no star), one taking a star, one breaking through (three); in their own list (ex, never the raids on him), the same each time, and they take nothing: his stores, piles, glory, truce and raids untouched; made once by themselves, cleared and made again on his say; on anyone else’s phone none are made and no replay plays', () => {
    const owner = !!data.isOwner();
    const realm = () => {
      const s = F.fresh(T0 - 3 * DAY), B4 = F.botBase(4);
      s.b = B4.b.map(b => Object.assign({}, b, F.KINDS[b.t].role === 'make' ? {c: T0 - 6 * F.HOUR} : {}));
      s.nb = Math.max(...s.b.map(b => b.i)) + 1;
      Object.assign(s, {r: {gold: 30000, grain: 20000}, tp: 120, sh: T0 - F.HOUR, lr: T0 - 2 * F.HOUR, hr: {knight: 3}, ar: {footman: 5}, df: [{id: 'd1', at: T0 - DAY, by: 'Mossgate', th: 3, st: 0, pc: 10, lt: [0, 0], ls: [0, 0], lb: {}, td: 9}]});
      return s;
    };
    const s = realm(), before = JSON.stringify(s), t0 = performance.now();
    const ex = exampleRaids(s, T0), ms = Math.round(performance.now() - t0);
    const rest = JSON.parse(JSON.stringify(s));
    delete rest.ex; delete rest.exv; delete rest.lots;
    const untouched = JSON.stringify(rest) === before;
    if (!owner) {
      const t = realm(), made = ensureExamples(t, T0), rec = {id: 'x', ex: true, rp: F.snapOf(makeBattle(F.botBase(1), null, {footman: 1}))};
      const none = !ex.length && untouched && !('ex' in s) && !made && !('exv' in t) && F.replayOf(rec) === null && replayRaid(rec) === null;
      return {pass: none, detail: `not the owner’s phone: none made ${!ex.length}, nothing changed ${untouched}, ensureExamples ${made}, no replay ${F.replayOf(rec) === null}`};
    }
    const stars = ex.map(r => r.st).join() === '0,1,3';
    const shape = ex.length === 3 && s.ex === ex && s.exv === F.EX_V && ex.every(r => r.ex === true && r.td === 0 && r.ls.join() === '0,0' && !Object.keys(r.lb).length && r.at === T0 && r.by && r.rp)
      && new Set(ex.map(r => r.id)).size === 3 && ex.every(r => { const f = F.findRaid(s, r.id); return f && f.kind === 'ex' && f.rec === r; }) && s.df.length === 1;
    const plays = ex.every(r => { const R = replayRaid(r, s); if (!R) return false; R.play(Infinity); return same(R, r) && R.defenders.length === 1; });
    const twin = realm();
    exampleRaids(twin, T0);
    const sameEach = JSON.stringify(twin.ex) === JSON.stringify(s.ex);
    // (made once: a realm from before them gets them on opening, then never again by itself; cleared, they stay cleared)
    const u = realm(), first = ensureExamples(u, T0), second = ensureExamples(u, T0 + DAY);
    const cleared = F.clearExamples(u) && !('ex' in u) && u.exv === F.EX_V && !ensureExamples(u, T0 + DAY) && !('ex' in u);
    const renewed = exampleRaids(u, T0 + DAY).length === 3 && u.ex.length === 3 && u.ex[0].at === T0 + DAY;
    const once = first && !second && u.exv === F.EX_V;
    const ok = stars && shape && plays && untouched && sameEach && once && cleared && renewed && ms < 3000;
    return {pass: ok, detail: `${ex.map(r => `${r.by} ${r.st}★ ${r.pc}% (would have taken ${r.lt.join('/')}; ${JSON.stringify((F.decodeReplay(r.rp, s) || {}).army)})`).join(' · ')} in ${ms} ms; 0/1/3 stars ${stars}; in their own list, taking nothing ${shape}; replays the same ${plays}; his realm untouched ${untouched}; the same each time ${sameEach}; made once ${once}; cleared ${cleared}; made again ${renewed}`};
  });

  check('Keepfall: a half day that already has a raid on him on the record has no other (Oct 22 2026, the day the hour moved: the morning’s raid had come at the old hour, 05:23, and the new hour, 07:58, would have raided him again that morning); the rest of the day as it comes', () => {
    const at = (h, m) => new Date(2026, 9, 22, h, m).getTime();
    const s = {born: 0, lr: at(5, 23), df: [{id: 'd1', at: at(5, 23), by: 'Mossgate', th: 3, st: 0, pc: 20, lt: [0, 0], ls: [0, 0], lb: {}, td: 9}]};
    const due = raidsDue(s, at(23, 54)), plain = raidsDue({born: 0, lr: at(5, 23)}, at(23, 54));
    const am = due.filter(t => t < at(12, 0)), pm = due.filter(t => t >= at(12, 0));
    const ok = !am.length && pm.length === 1 && plain.filter(t => t < at(12, 0)).length === 1 && plain.filter(t => t >= at(12, 0)).length === 1;
    const hm = t => new Date(t).toTimeString().slice(0, 5);
    return {pass: ok, detail: `after a 05:23 raid on the record: ${due.map(hm).join(', ') || 'none'} (morning ${am.length}, evening ${pm.length}); without it: ${plain.map(hm).join(', ')}`};
  });

  check('Keepfall: a raid on him that takes from a mine’s or brewery’s full pile takes it off the pile (a pile left past its day stops growing: what was taken came off nothing till Oct 22 2026)', () => {
    const s = F.fresh(T0 - 5 * DAY);
    s.b.find(b => b.t === 'keep').l = 4;
    const p = F.spotFor(s, 'mine');
    s.b.push({i: s.nb++, t: 'mine', l: 4, x: p.x, y: p.y, u: 0, c: T0 - 72 * F.HOUR});
    const m = s.b[s.b.length - 1], full = F.made(m, T0), took = Math.floor(full * F.MADE_SHARE);
    F.takeRaid(s, {id: 'd1', at: T0, by: 'Mossgate', th: 3, st: 1, pc: 55, lt: [took, 0], ls: [0, 0], lb: {[m.i]: [took, 0]}, td: -12});
    const left = F.made(m, T0), later = F.made(m, T0 + 2 * F.HOUR);
    const q = F.fresh(T0 - 5 * DAY), p2 = F.spotFor(q, 'farm');
    q.b.push({i: q.nb++, t: 'farm', l: 1, x: p2.x, y: p2.y, u: 0, c: T0 - 3 * F.HOUR});
    const f = q.b[q.b.length - 1], before = F.made(f, T0);
    F.takeRaid(q, {id: 'd2', at: T0, by: 'Briarwatch', th: 2, st: 0, pc: 10, lt: [0, 15], ls: [0, 0], lb: {[f.i]: [0, 15]}, td: 3});
    const ok = full === F.stat('mine', 4).hold && left === full - took && later > left && F.made(f, T0) === before - 15;
    return {pass: ok, detail: `a level 4 mine left 72 h: ${full} piled (full), a quarter taken (${took}): ${left} left, ${later} two hours on; a brewery not yet full: ${before} → ${F.made(f, T0)} after 15 taken`};
  });

  check('Keepfall: a copy of his realm saved by a phone that never had the example raids (an older version, or one that hadn’t made them) doesn’t lose them: this phone’s are kept, with the lot they were played on, and so are a record’s replay the newer copy lacks; examples cleared on another phone stay cleared', () => {
    const owner = !!data.isOwner();
    const mk = () => { const s = F.fresh(T0 - 3 * DAY); s.b.find(b => b.t === 'keep').l = 3; s.r = {gold: 9000, grain: 9000}; return s; };
    const local = mk();
    local.ex = [{id: 'x1', at: T0, by: 'Mossgate', th: 3, st: 0, pc: 10, lt: [0, 0], ls: [0, 0], lb: {}, td: 0, ex: true}];
    const B = makeBattle(local, F.lootOf(local, T0), {footman: 3}), bx = F.boxOf(local);
    B.deploy('footman', bx.x0 - 1.5, bx.y0); B.run(4); B.end();
    local.ex[0].rp = F.snapOf(B, {into: local}); local.exv = F.EX_V;
    local.df = [{id: 'd1', at: T0 - F.HOUR, by: 'Briarwatch', th: 2, st: 0, pc: 0, lt: [0, 0], ls: [0, 0], lb: {}, td: 6, rp: F.snapOf(B, {into: local})}];
    // (newer, from a phone on the app before examples: no exv, the raid without its replay)
    const remote = F.clean(Object.assign(JSON.parse(JSON.stringify(local)), {at: local.at + 60000}));
    delete remote.ex; delete remote.exv; delete remote.lots; delete remote.df[0].rp;
    const kept = F.keepMine(remote, local) && remote.ex && remote.ex.length === 1 && remote.exv === F.EX_V && !!remote.df[0].rp
      && !!F.decodeReplay(remote.ex[0].rp, remote) && !!F.decodeReplay(remote.df[0].rp, remote) && JSON.stringify(F.clean(remote)) === JSON.stringify(remote);
    // (cleared on the other phone: exv there, no ex)
    const cleared = F.clean(Object.assign(JSON.parse(JSON.stringify(local)), {at: local.at + 60000}));
    F.clearExamples(cleared);
    const stays = !F.keepMine(cleared, local) && !('ex' in cleared);
    return {pass: kept && stays, detail: `kept from this phone ${kept} (examples ${remote.ex ? remote.ex.length : 0}, the raid’s replay ${!!remote.df[0].rp}, lots ${Object.keys(remote.lots || {}).length}); cleared elsewhere stays cleared ${stays}${owner ? '' : ' (not the owner’s phone)'}`};
  });

  check('Keepfall: the example raids are made a slice at a time on his phone (exampleRaidsAsync: at once they held Keepfall still for seconds), the same three as all at once, put on the realm as it is when they’re done; stopped (Keepfall closed, another profile) nothing is put anywhere; on anyone else’s phone none', async () => {
    const owner = !!data.isOwner();
    const realm = () => {
      const s = F.fresh(T0 - 3 * DAY), B5 = F.botBase(5);
      s.b = B5.b.map(b => Object.assign({}, b, F.KINDS[b.t].role === 'make' ? {c: T0 - 6 * F.HOUR} : {}));
      s.b.find(b => b.t === 'wall').l = 1; // (his own lot, not the computer's)
      Object.assign(s, {nb: Math.max(...s.b.map(b => b.i)) + 1, r: {gold: 30000, grain: 20000}, hr: {knight: 3, wizard: 2}});
      return s;
    };
    const RB = await import('./realm-battle.js');
    const a = realm(), b = realm(), into = realm(), t0 = performance.now();
    const sync = exampleRaids(a, T0), ms = Math.round(performance.now() - t0);
    let longest = 0, last = performance.now(), ticking = true;
    const tick = () => { const n = performance.now(); longest = Math.max(longest, n - last); last = n; if (ticking) setTimeout(tick, 0); };
    setTimeout(tick, 0);
    let slices = 0;
    const t1 = performance.now(), got = await RB.exampleRaidsAsync(b, T0, {into: () => into, still: () => ++slices > 0});
    ticking = false;
    const wall = Math.round(performance.now() - t1);
    if (!owner) {
      const none = got === null && !('ex' in b) && !('ex' in into) && !sync.length;
      return {pass: none, detail: `not the owner’s phone: none made ${none}`};
    }
    const same = !!got && JSON.stringify(into.ex) === JSON.stringify(a.ex) && !('ex' in b) && !('exv' in b) && JSON.stringify(into.lots) === JSON.stringify(a.lots);
    let n = 0;
    const c = realm(), stopped = await RB.exampleRaidsAsync(c, T0, {still: () => ++n < 5});
    const off = stopped === null && !('ex' in c) && !('exv' in c);
    const busyOnce = (() => { const p1 = RB.exampleRaidsAsync(realm(), T0, {still: () => false}), p2 = RB.exampleRaidsAsync(realm(), T0); return p1 === p2; })();
    await new Promise(r => setTimeout(r, 0));
    // (in slices: the page had its turn between them, many times over)
    const ok = same && off && busyOnce && slices >= 20 && ms < 3000;
    return {pass: ok, detail: `${a.ex.map(r => `${r.st}★`).join(' ')}: all at once ${ms} ms; a slice at a time ${wall} ms in ${slices} slices, the page’s longest wait ${Math.round(longest)} ms (with the other checks running); the same three, on the realm given ${same}; stopped: nothing put ${off}; one at a time ${busyOnce}`};
  });

  check('Keepfall: the Chronicle’s ▶ Watch (views/realm.js): on a raid on his realm, an attack of his or an example raid only where it has a replay (rp that reads back), none on an older record without one or a broken one; each opens its own (#/realm/replay/<id>)', async () => {
    const view = await import('../views/realm.js');
    const s = top(), B = makeBattle(F.botBase(1), null, {footman: 1});
    B.deploy('footman', 2.5, 3.5); B.run(1); B.end();
    const rp = F.snapOf(B), broken = Object.assign({}, rp, {p: 'x'});
    s.rd = [{id: 'a1', vs: 'bot:1', nm: 'Thornfield Hamlet', at: T0 - 3e5, st: 0, pc: 0, lt: [0, 0], ta: 0, rp}, {id: 'a2', vs: 'bot:1', nm: 'Thornfield Hamlet', at: T0 - 2e5, st: 0, pc: 0, lt: [0, 0], ta: 0},
      {id: 'a3', vs: 'bot:1', nm: 'Thornfield Hamlet', at: T0 - 1e5, st: 0, pc: 0, lt: [0, 0], ta: 0, rp: broken}];
    s.df = [{id: 'd1', at: T0 - 4e5, by: 'Briarwatch', th: 2, st: 0, pc: 0, lt: [0, 0], ls: [0, 0], lb: {}, td: 6, rp}, {id: 'd2', at: T0 - 5e5, by: 'Briarwatch', th: 2, st: 0, pc: 0, lt: [0, 0], ls: [0, 0], lb: {}, td: 6}];
    s.ex = [{id: 'x1', at: T0, by: 'Mossgate', th: 3, st: 0, pc: 0, lt: [0, 0], ls: [0, 0], lb: {}, td: 0, ex: true, rp}];
    const page = (view._screens(s, T0) || []).find(p => p.where === 'The Chronicle');
    const t = document.createElement('template');
    t.innerHTML = page ? page.html : '';
    const ids = [...t.content.querySelectorAll('[data-rl-watch]')].map(e => e.getAttribute('data-rl-watch')).sort().join();
    const want = ['a1', 'd1', 'x1'].join();
    const route = await import('../app.js').then(app => { const r = app.parseRoute('/realm/replay/d1'); return data.isOwner() ? !!r && r.view === 'realm-replay' && r.params && r.params.id === 'd1' : !r || r.view !== 'realm-replay'; }).catch(() => false);
    return {pass: !!page && ids === want && route, detail: `▶ on ${ids || 'nothing'} (want ${want}); the route ${route}`};
  });

  check('Keepfall: his old Franchise save is taken up as his realm (Stadium to Castle, booths to gold mines, coolers to breweries, cannons to ballistas, fences to walls; Cash to Gold, Juice to Ale; receivers to footmen, kickers to dragons), the same twice, and raids on people dropped', () => {
    const old = {v: 1, at: T0, born: T0 - DAY, nm: '', tp: 40, nb: 9, sh: 0,
      b: [{i: 1, t: 'stadium', l: 3, x: 16, y: 16, u: 0}, {i: 2, t: 'office', l: 1, x: 17, y: 12, u: 0}, {i: 3, t: 'booth', l: 2, x: 11, y: 16, u: 0, c: T0 - F.HOUR},
        {i: 4, t: 'cooler', l: 1, x: 22, y: 16, u: 0, c: T0}, {i: 5, t: 'cannon', l: 2, x: 17, y: 21, u: 0}, {i: 6, t: 'fence', l: 2, x: 5, y: 5, u: 0},
        {i: 7, t: 'jugs', l: 1, x: 26, y: 26, u: 0}, {i: 8, t: 'practice', l: 2, x: 4, y: 24, u: T0 + 60e3}],
      r: {cash: 1234, juice: 567}, cl: {cash: 100, juice: 200}, xo: {cash: 1500, juice: 1600},
      ar: {receiver: 5, kicker: 1}, q: [['qb', 3]], qs: T0,
      rd: [{id: 'r1', vs: 'bot:2', nm: 'Bot', at: T0, st: 2, lt: [10, 10]}, {id: 'r2', vs: 'mason', at: T0, st: 1, lt: [5, 5]}], ap: ['r9']};
    const s = F.clean(old), kinds = s ? s.b.map(b => b.t).join(',') : '';
    const ok = !!s && s.v === 2 && kinds === 'keep,hut,mine,farm,ballista,wall,trebuchet,barracks' && F.keepOf(s) === 3 && s.b[2].c === T0 - F.HOUR && s.b[7].u === T0 + 60e3
      && JSON.stringify(s.r) === '{"gold":1234,"grain":567}' && JSON.stringify(s.cl) === '{"gold":100,"grain":200}' && JSON.stringify(s.xo) === '{"gold":1500,"grain":1600}'
      && JSON.stringify(s.ar) === '{"footman":5,"dragon":1}' && JSON.stringify(s.q) === '[["archer",3]]' && s.tp === 40
      && s.rd.length === 1 && s.rd[0].vs === 'bot:2' && !('ap' in s) && Array.isArray(s.df);
    const twice = !!s && JSON.stringify(F.clean(s)) === JSON.stringify(s);
    const fresh = F.clean(F.fresh(T0)), keptNew = !!fresh && fresh.xo.gold === 1500 && fresh.r.gold === 0;
    return {pass: ok && twice && keptNew, detail: s ? `${kinds}; Castle ${F.keepOf(s)}; stored ${JSON.stringify(s.r)}, coffers taken ${JSON.stringify(s.cl)}, besides ${JSON.stringify(s.xo)}; army ${JSON.stringify(s.ar)}, training ${JSON.stringify(s.q)}; raids kept ${s.rd.map(r => r.vs).join(',')}; the same twice ${twice}; a new realm as it was ${keptNew}` : 'not taken up'};
  });

  check('Keepfall: a building’s card (the owner’s ask, Oct 22 2026, after Clash of Clans’ info screen): every kind’s card has its name and level over a bar of its levels, the red close, a picture of it at its level, its stat tiles (strength for all; the hour’s make and the pile for mines and breweries; capacity and how full for treasuries and cellars; storage and what the next level unlocks for the Castle; damage a second, range and ground or air for defenses; room for war camps and the hatchery; the soldiers for barracks; the builder; the walls), the next level’s gain in green while it can go up, Upgrade with its cost beside the Upgrade time box, and Move; going up shows how far along and the time left; at the top, Max level and no Upgrade; not enough says so in red; a level the Castle doesn’t allow yet names the Castle level', async () => {
    const view = await import('../views/realm.js');
    const M = 60e3;
    // (a realm at Castle level keep with the buildings listed, [kind, level, extra], none of it kept anywhere)
    const realm = (keep, list, extra = {}) => {
      const s = F.fresh(T0 - DAY);
      s.b = s.b.filter(b => b.t === 'keep' || b.t === 'hut');
      s.b.find(b => b.t === 'keep').l = keep;
      Object.assign(s, {r: {gold: 30000, grain: 30000}, ar: {footman: 12}}, extra);
      list.forEach(([t, l, x]) => { const p = F.spotFor(s, t); if (p) s.b.push(Object.assign({i: s.nb++, t, l, x: p.x, y: p.y, u: 0}, F.KINDS[t].role === 'make' ? {c: T0 - 3 * F.HOUR} : {}, x || {})); });
      return s;
    };
    const tpl = document.createElement('template'), pages = new WeakMap();
    // (a card's words, a text node at a time, so a label and its value stay apart)
    const words = el => { if (!el) return ''; const out = [], w = document.createTreeWalker(el, 4); while (w.nextNode()) out.push(w.currentNode.nodeValue); return out.join(' ').replace(/\s+/g, ' ').trim(); };
    const cardOf = (s, t) => {
      const b = s.b.find(x => x.t === t);
      if (!pages.has(s)) pages.set(s, view._screens(s, T0));
      const page = b && pages.get(s).find(p => p.html.includes(`data-rl-card="${b.i}"`));
      tpl.innerHTML = page ? page.html : '';
      const c = tpl.content.cloneNode(true), q = sel => c.querySelector(sel);
      return {b, q, text: sel => words(q(sel)), tiles: [...c.querySelectorAll('[data-tile]')].map(e => e.dataset.tile)};
    };
    const TILES = {hall: ['hp', 'store', 'unlocks'], builder: ['hp', 'builder', 'max'], make: ['hp', 'rate', 'pile'], store: ['hp', 'cap', 'stored'], train: ['hp', 'troops', 'trains'],
      camp: ['hp', 'room', 'army'], hatch: ['hp', 'dragons', 'hatched'], def: ['hp', 'dps', 'range', 'targets'], wall: ['hp', 'walls']};
    // every kind, idle, at Castle 6 (the Castle can't afford its next level)
    const A = realm(6, [['mine', 3], ['farm', 1], ['treasury', 2], ['granary', 4], ['barracks', 4], ['camp', 2], ['hatchery', 1], ['cannon', 2], ['ballista', 3], ['tower', 2], ['trebuchet', 1], ['cauldron', 1], ['wall', 2]]);
    const bad = [];
    F.ORDER.forEach(t => {
      const c = cardOf(A, t), K = F.KINDS[t];
      if (!c.b) { bad.push(`${t}: no building`); return; }
      const lv = Math.max(1, c.b.l), top = F.maxLevel(t), idle = t !== 'hut' && lv < top;
      const head = c.text('.rl-card-t') === `${K.name} Level ${c.b.l}` && !!c.q('.rl-card-lvbar i') && !!c.q('.rl-card-x[data-rl-unsel]') && !!c.q(`[data-rl-art="${t}:${lv}"]`);
      const tiles = JSON.stringify(c.tiles) === JSON.stringify(TILES[K.role]);
      const gain = !idle || !!c.q('[data-tile="hp"] .rl-tile-gain');
      const up = !idle || (!!c.q(`[data-rl-up="${c.b.i}"]`) && /Upgrade time/.test(c.text('.rl-card-time')) && c.text('.rl-card-up-c').includes(Number(K.cost[lv]).toLocaleString('en-US')));
      const move = !!c.q(`[data-rl-move="${c.b.i}"]`);
      if (!(head && tiles && gain && up && move)) bad.push(`${t}: head ${head}, tiles ${c.tiles.join('/')} ${tiles}, gain ${gain}, upgrade ${up}, move ${move}`);
    });
    const brew = cardOf(A, 'farm'), castle = cardOf(A, 'keep'), barracks = cardOf(A, 'barracks'), cannon = cardOf(A, 'cannon'), tower = cardOf(A, 'tower');
    const said = {
      brewery: /Ale per hour 20 Level 2: \+15\/hour/.test(brew.text('[data-tile="rate"]')) && /60 \/ 480/.test(brew.text('[data-tile="pile"]')) && !!brew.q('[data-rl-collect]'),
      castle: /Infernal Wastes/.test(castle.text('[data-tile="unlocks"]')) && !!castle.q('.rl-card-up.is-short[aria-disabled="true"]') && /Not enough Gold/.test(castle.text('.rl-card-up')) && !!castle.q('[data-rl-army]'),
      barracks: /\+Thief/.test(barracks.text('[data-tile="troops"]')) && !!barracks.q('[data-tile="trains"] .rl-uchip.is-new'),
      defenses: /8 tiles/.test(cannon.text('[data-tile="range"]')) && /Ground only/.test(cannon.text('[data-tile="targets"]')) && /Ground & air/.test(tower.text('[data-tile="targets"]'))
    };
    // a job on: the treasury going up a level, the cannon waiting on the builder, a mine waiting on the Castle
    const B = realm(5, [['treasury', 2, {u: T0 + 25 * M}], ['cannon', 2], ['mine', 9]]);
    const job = cardOf(B, 'treasury'), wait = cardOf(B, 'cannon'), locked = cardOf(B, 'mine');
    const prog = job.q('[data-rl-card-prog]');
    const states = {
      upgrading: !!prog && +prog.getAttribute('aria-valuenow') > 0 && /Upgrading to level 3/.test(job.text('[data-rl-card-prog]')) && /Time left 25m/.test(job.text('.rl-card-time')) && !job.q('[data-rl-up]') && !job.q('.rl-tile-gain'),
      busy: /busy on the Treasury/.test(wait.text('.rl-card-up')) && !!wait.q('.rl-card-up[aria-disabled="true"]'),
      castleLevel: /Castle level 6 to upgrade/.test(locked.text('.rl-card-up')) && !!locked.q('.rl-card-up.is-locked')
    };
    // at the top: Max level, nothing to upgrade; and testing, upgrades at once
    const C = realm(8, [['wall', 8], ['cannon', 10], ['granary', 3]], {tst: 1});
    const maxed = ['keep', 'wall', 'cannon'].every(t => { const c = cardOf(C, t); return !!c.q('[data-tile="max"]') && !c.q('[data-rl-up]') && !c.q('[data-tile="unlocks"]'); });
    const once = /At once/.test(cardOf(C, 'granary').text('.rl-card-time'));
    const ok = !bad.length && Object.values(said).every(Boolean) && Object.values(states).every(Boolean) && maxed && once;
    return {pass: ok, detail: `${F.ORDER.length} kinds: ${bad.length ? bad.join('; ') : 'each with its head, tiles, gain, Upgrade and Move'}; ${Object.entries(said).map(([k, v]) => `${k} ${v}`).join(', ')}; ${Object.entries(states).map(([k, v]) => `${k} ${v}`).join(', ')}; max level ${maxed}; testing at once ${once}`};
  });

  check('Keepfall: the words (the owner, Oct 21 2026): the game is Keepfall (its Daily Games case, its title), its second currency Ale (breweries brew it, cellars hold it, the army trains with it) and its main building the Castle; nothing on its screen, on any building’s card or the card placing one, in any sheet, or in what it says when something can’t be done says Grain, Farm, Granary, Keep level or the Realm (the camera’s Realm view, the whole of the lot’s land, is a place, not the game); the ids and saves keep the old names (grain, farm, granary, keep), so every save loads as it was', async () => {
    const [view, games] = await Promise.all([import('../views/realm.js'), import('../views/games.js')]);
    // two realms to read: a new one, and one with everything in it (a brewery going up, a cellar being upgraded, Ale
    // piled up to collect, an army and a line in training, a raid each way, a truce), nothing written anywhere
    const bare = F.fresh(T0), full = F.fresh(T0 - 3 * DAY);
    full.r = {gold: 100, grain: 100};
    const put = (t, l, extra = {}) => { const p = F.spotFor(full, t); if (p) full.b.push(Object.assign({i: full.nb++, t, l, x: p.x, y: p.y, u: 0}, F.KINDS[t].role === 'make' ? {c: T0 - 5 * F.HOUR} : {}, extra)); };
    [['treasury', 2], ['granary', 1], ['barracks', 6], ['camp', 2], ['hatchery', 1], ['cannon', 1], ['tower', 1], ['trebuchet', 1], ['cauldron', 1], ['wall', 2]].forEach(([t, l]) => put(t, l));
    put('farm', 0, {u: T0 + F.HOUR});
    put('granary', 1, {u: T0 + 600e3});
    Object.assign(full, {ar: {footman: 3, thief: 2}, q: [['archer', 2]], qs: T0 - 1000, tp: 40, sh: T0 + F.HOUR,
      rd: [{id: 'a1', vs: 'bot:2', nm: 'Briarwatch', at: T0 - F.HOUR, st: 2, pc: 60, lt: [500, 400], ta: 16}],
      df: [{id: 'd1', at: T0 - 2 * F.HOUR, by: 'Thornfield Hamlet', th: 1, st: 1, pc: 55, lt: [300, 200], ls: [300, 200], lb: {}, td: -3},
        {id: 'd2', at: T0 - 3 * F.HOUR, by: 'Briarwatch', th: 2, st: 0, pc: 20, lt: [0, 0], ls: [0, 0], lb: {}, td: 6}]});
    const earned = {total: {gold: 5000, grain: 7200}, by: {puzzles: {gold: 3000, grain: 7200}, kick: {gold: 2000, grain: 0}}, today: {puzzles: {gold: 0, grain: 3200}, kick: {gold: 1000, grain: 0}},
      pending: {drill: {n: 9, place: 2, of: 6, grain: 4000}}, last: {puzzles: {n: 8, place: 3, of: 6, grain: 3200}}, days: 3};
    const pages = view._screens(bare, T0).concat(view._screens(full, T0, {done: full.df, earned}));
    // what it says when something can't be done (the toasts)
    const whys = [bare, full].flatMap(s => [...F.ORDER.map(k => F.canBuild(s, k, T0).why), ...s.b.map(b => F.canUpgrade(s, b.i, T0).why), ...F.TROOP_ORDER.map(t => F.canTrain(s, t).why)]).filter(Boolean);
    // every word a page shows or reads out: its text (a node at a time, so words in neighbouring tags stay apart) and
    // its labels
    const tpl = document.createElement('template');
    const textOf = html => {
      tpl.innerHTML = html;
      tpl.content.querySelectorAll('[data-rl-world]').forEach(e => e.remove()); // (the camera's Realm view: a place)
      const c = tpl.content, out = [], w = c.ownerDocument.createTreeWalker(c, 4);
      while (w.nextNode()) out.push(w.currentNode.nodeValue);
      c.querySelectorAll('*').forEach(e => ['aria-label', 'title', 'alt', 'placeholder', 'value'].forEach(a => { if (e.getAttribute(a)) out.push(e.getAttribute(a)); }));
      return out.join(' \n ');
    };
    // (and each building's blurb, which its card no longer shows but scouting a realm's still does)
    const read = pages.map(p => ({where: p.where, text: textOf(p.html)})).concat(whys.map(t => ({where: 'a toast', text: t})),
      F.ORDER.map(k => ({where: `the ${k}’s blurb (scouting)`, text: F.KINDS[k].blurb || ''})));
    const BAD = [/\b(?:grain|farms?|granar(?:y|ies))\b/i, /\bkeep level\b/i, /(?<!The )\bKeep\b/, /\bRealm\b/];
    const found = [];
    read.forEach(({where, text}) => BAD.forEach(re => { const m = text.match(re); if (m) found.push(`${where}: “${m[0]}”`); }));
    // and in the code's own words (toasts and the rest written out in the views; comments aside, where the old names
    // still explain the ids)
    const files = ['../views/realm.js', '../views/realm-raid.js', '../views/realm-scout.js', './realm.js', './realm-battle.js', '../views/realm-replay.js'];
    const src = await Promise.all(files.map(f => fetch(new URL(f, import.meta.url)).then(r => r.text())));
    const code = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1').replace(/(data-rl-world[^>]*>)Realm</g, '$1<'); // (the camera's Realm view)
    const CODE_BAD = /\b(?:Grain|Farms?|farms|Granar(?:y|ies)|granaries)\b|\bKeep level\b|\b(?:your|the|a) Keep\b|\bRealm\b/;
    files.forEach((f, i) => { const m = code(src[i]).match(CODE_BAD); if (m) found.push(`${f.replace(/^.*\//, '')}: “${m[0]}”`); });
    // and, in any case, the words in the code's strings (a template's text between its ${…}, every string that isn't a
    // lone id, a class or a tag): the raid's and scouting's screens aren't among the pages read above, and there a line
    // like "gold and grain" or "its granary" would get past CODE_BAD, the ids being those words in lower case
    const LOW = /\b(?:grain|farms?|granar(?:y|ies))\b/i, heroes = await fetch(new URL('../views/realm-heroes.js', import.meta.url)).then(r => r.text());
    files.concat('../views/realm-heroes.js').forEach((f, i) => {
      const v = sayings(i < src.length ? src[i] : heroes).find(x => LOW.test(x));
      if (v) found.push(`${f.replace(/^.*\//, '')}: “${v.match(LOW)[0]}” in “${v.slice(0, 60)}”`);
    });
    // and each amount says which it is to a screen reader (its coin or tankard is a picture)
    const spoken = /\b2,500 Ale\b/.test(textOf(view.curHTML('grain', 2500)).replace(/\s+/g, ' ')) && /\b2,500 Gold\b/.test(textOf(view.curHTML('gold', 2500)).replace(/\s+/g, ' '));
    const all = read.map(r => r.text).join(' \n ');
    const missing = ['Ale', 'brew Ale', 'Brews Ale', 'Brewery', 'breweries', 'Cellar', 'cellars', 'Castle level', 'Not enough Ale'].filter(w => !all.includes(w));
    // the Daily Games case and the title (it has no tab of its own)
    const kase = games.GAMES.find(g => g.id === 'keep');
    const tab = !!kase && kase.name === 'Keepfall' && kase.title === 'Keepfall' && view.default.title === 'Keepfall';
    // the names on screen are new; the ids and what's saved are as they were
    const names = F.CUR_NAME.gold === 'Gold' && F.CUR_NAME.grain === 'Ale' && F.KINDS.keep.name === 'Castle' && F.KINDS.farm.name === 'Brewery' && F.KINDS.granary.name === 'Cellar';
    const ids = F.CUR.join() === 'gold,grain' && F.KINDS.farm.makes === 'grain' && F.KINDS.granary.holds === 'grain' && F.ORDER.includes('farm') && F.ORDER.includes('granary') && F.ORDER[0] === 'keep'
      && Object.keys(bare.r).join() === 'gold,grain' && bare.b.some(b => b.t === 'farm');
    const back = F.clean(JSON.parse(JSON.stringify(full)));
    const loads = !!back && back.r.grain === 100 && back.b.map(b => b.t).join() === full.b.map(b => b.t).join() && JSON.stringify(back.ar) === JSON.stringify(full.ar);
    return {pass: !found.length && !missing.length && spoken && tab && names && ids && loads,
      detail: `${pages.length} pages and ${whys.length} toasts read; ${found.length ? 'old words: ' + found.slice(0, 12).join('; ') + (found.length > 12 ? ` (+${found.length - 12})` : '') : 'no old words'}${missing.length ? '; never says: ' + missing.join(', ') : ''}; an amount read out as “2,500 Ale” ${spoken}; the case ${kase ? `“${kase.name}”` : 'missing'}, the title “${view.default.title}” ${tab}; names ${names}; ids kept ${ids}; a save with everything loads as it was ${loads}`};
  });
}

/** The words in a script's strings: each quoted string, and a template's text between its ${…} (the code in those
 *  skipped, the strings in it taken too), the tags, class names and kebab-case ids taken out, and a string that's then
 *  a single word (an id: 'grain', 'farm') left out. Comments aside. */
function sayings(src) {
  const out = [], n = src.length;
  const str = i => { const q = src[i]; let b = ''; i++; while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { b += src[i + 1]; i += 2; } else b += src[i++]; } out.push(b); return i + 1; };
  const tpl = i => { let b = ''; i++; while (i < n && src[i] !== '`') { if (src[i] === '\\') { b += src[i + 1]; i += 2; } else if (src[i] === '$' && src[i + 1] === '{') { out.push(b); b = ''; i = expr(i + 2); } else b += src[i++]; } out.push(b); return i + 1; };
  const expr = i => { let d = 0; while (i < n) { const c = src[i]; if (c === '`') i = tpl(i); else if (c === "'" || c === '"') i = str(i); else { if (c === '{') d++; else if (c === '}') { if (!d) return i + 1; d--; } i++; } } return i; };
  for (let i = 0; i < n;) {
    const c = src[i];
    if (c === '`') i = tpl(i);
    else if (c === "'" || c === '"') i = str(i);
    else if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; }
    else if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; }
    else i++;
  }
  return out.map(v => v.replace(/<[^<>]*>/g, ' ').replace(/^[^<>]*>/, ' ').replace(/<[^<>]*$/, ' ').replace(/\w+(?:-\w+)+/g, ' ').trim()).filter(v => /\s/.test(v));
}
