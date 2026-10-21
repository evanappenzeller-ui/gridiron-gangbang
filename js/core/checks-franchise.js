// The Franchise's checks for the dev gallery (#/_kit): what the games pay, storage and the front office, booths and
// coolers, coaches and the Stadium's limits, training, a raid played out (the same every time), raids taken off the
// raided franchise once, shields and trophies, and THE RULE (CLAUDE.md) on crafted board docs: the franchises listed
// and raidable are the league's (members and Ryan D); a guest's or any other app user's only on their own phones and
// the owner's; guests raid only the computer's. checks.js imports franchiseChecks and calls it with its check(name,
// fn) helper; every fn returns true or {pass, detail}. Nothing here writes to storage or the database.
import * as F from './franchise.js';
import * as daily from './daily.js';
import * as data from './data.js';
import {makeBattle, replay} from './franchise-battle.js';
import {targets, ranking} from '../views/franchise.js';

const T0 = Date.UTC(2026, 9, 21, 12);

export async function franchiseChecks(check) {
  const [kk, rm, sv] = await Promise.all([import('./kick.js'), import('./return.js'), import('./seventeen.js').then(async m => { await m.load(); return m; })]);

  check('Franchise: the games pay in Cash and Juice alike, a day each per person (the first finished across their phones; Return Man’s best run): Daily Puzzles 400 + 5 a point, 17–0 400 + 150 a win, Kick It 400 + 200 a make (to 15), Return Man 400 + 3 a yard (to 1,000)', () => {
    const a = {id: 'fx-a', nick: 'Mason', days: {10: {v: 4, p: 400, t: 2}}, kk1: {2: {m: 5, l: 40, y: 150, k: 8, t: 10}}, rm2: {1: {y: 300, l: 300, td: 3, t: 5}}, s17: {3: {w: 12, l: 5, p: 21.5, r: 0, k: '01234', t: 3}}};
    const b = {id: 'fx-b', nick: 'Mason', days: {10: {v: 4, p: 600, t: 5}, 11: {v: 4, p: 100, t: 6}}, kk1: {2: {m: 9, l: 48, y: 330, k: 12, t: 20}}, rm2: {1: {y: 900, l: 900, td: 9, t: 9}}};
    const inc = F.incomeOf([a, b], {kk, rm, sv});
    const want = {puzzles: 2400 + 900, '17-0': 400 + 150 * 12, kick: 400 + 200 * 5, return: 400 + 3 * 900};
    const ok = Object.entries(want).every(([g, v]) => inc.by[g] === v) && inc.total === Object.values(want).reduce((x, y) => x + y, 0);
    const cap = F.PAY.kick({m: 40}) === 3400 && F.PAY.return({y: 5000}) === 3400 && F.PAY['17-0']({w: 17}) === 400 + 150 * 17 + 500;
    return {pass: ok && cap, detail: `by ${JSON.stringify(inc.by)} total ${inc.total}; caps ${cap}`};
  });

  check('Franchise: a new franchise holds 2,500 of each in its Stadium; the front office keeps what doesn’t fit (games’ pay and the starter 1,500) and moves it in as room opens; a ticket booth makes 20 Cash an hour up to 10 hours’ worth, collected as far as there’s room, and stops while it’s upgraded', () => {
    const s = F.fresh(T0), cap = F.capOf(s);
    const moved = F.claim(s, 10000), pend = F.pending(s, 10000);
    const booth = s.b.find(b => b.t === 'booth');
    const m3 = F.made(booth, T0 + 3 * F.HOUR), m30 = F.made(booth, T0 + 30 * F.HOUR);
    const full = F.collect(s, booth.i, T0 + 3 * F.HOUR); // storage is full: nothing comes in
    s.r.cash -= 100;
    const got = F.collect(s, booth.i, T0 + 3 * F.HOUR), left = F.made(booth, T0 + 3 * F.HOUR);
    s.r.juice = 2500;
    const up = F.upgrade(s, booth.i, T0 + 4 * F.HOUR), during = F.made(booth, T0 + 4 * F.HOUR + 30e3);
    F.tick(s, T0 + 4 * F.HOUR + 61e3);
    const after = booth.l === 2 && F.made(booth, T0 + 5 * F.HOUR + 61e3) === 35;
    const ok = cap.cash === 2500 && cap.juice === 2500 && moved.cash === 2500 && pend.cash === 9000 && m3 === 60 && m30 === 200 && full === 0 && got === 60 && left === 0
      && up && during === 0 && after;
    return {pass: ok, detail: `cap ${JSON.stringify(cap)}, moved ${moved.cash}, waiting ${pend.cash}; booth 3h ${m3}, 30h ${m30}; full ${full}, then ${got} (left ${left}); upgrading ${up}, making ${during}; after ${after}`};
  });

  check('Franchise: a coach does one job at a time (a second office is a second coach, up at once); the Stadium’s level caps how many of each and how high (one booth at level 1, a T-shirt cannon past level 2 needs Stadium 2); a fence needs no coach', () => {
    const s = F.fresh(T0);
    s.r.cash = 2500; s.r.juice = 2500;
    const v = F.spotFor(s, 'vault'), built = F.build(s, 'vault', v.x, v.y, T0);
    const busy = F.canBuild(s, 'tank', T0).why;
    const o = F.spotFor(s, 'office'), off = F.build(s, 'office', o.x, o.y, T0), two = F.coaches(s, T0);
    const tank = F.canBuild(s, 'tank', T0).ok;
    const booth = F.canBuild(s, 'booth', T0).why;
    const can = s.b.find(b => b.t === 'cannon');
    can.l = 2;
    const gate = F.canUpgrade(s, can.i, T0).why;
    const fence = F.canBuild(s, 'fence', T0).why;
    s.b.find(b => b.t === 'stadium').l = 2;
    s.r.cash = 2500;
    const f = F.spotFor(s, 'fence'), fb = F.build(s, 'fence', f.x, f.y, T0);
    const ok = !!built && built.l === 0 && busy === 'Every coach is busy' && !!off && off.l === 1 && two.total === 2 && two.free === 1 && tank
      && /Stadium level 2/.test(booth) && /Stadium level 2/.test(gate) && /Stadium level 2/.test(fence) && !!fb && fb.l === 1 && fb.u === 0;
    return {pass: ok, detail: `vault ${!!built}; then: ${busy}; 2nd office ${!!off}, coaches ${JSON.stringify(two)}, tank ${tank}; booth: ${booth}; cannon 3: ${gate}; fence at 1: ${fence}; at 2: ${fb ? 'up at once' : 'no'}`};
  });

  check('Franchise: the team trains one at a time with Juice (a receiver 5 s on one practice field), into the locker rooms’ room; a full locker room takes no more; one taken out of training gives its Juice back', () => {
    const s = F.fresh(T0);
    s.b.push({i: 50, t: 'practice', l: 1, x: 3, y: 3, u: 0}, {i: 51, t: 'locker', l: 1, x: 3, y: 9, u: 0});
    s.r.juice = 2500;
    const ok20 = F.train(s, 'receiver', 20, T0), more = F.canTrain(s, 'receiver').why, qbLocked = F.canTrain(s, 'qb').why;
    F.tick(s, T0 + 61e3);
    const at60 = s.ar.receiver;
    const juice = s.r.juice;
    F.untrain(s, 'receiver', T0 + 61e3);
    const back = s.r.juice - juice;
    F.tick(s, T0 + 200e3);
    const ok = ok20 && /full/.test(more) && /level 2/.test(qbLocked) && at60 === 12 && back === 25 && s.ar.receiver === 19 && !s.q.length;
    return {pass: ok, detail: `20 in ${ok20}; 21st: ${more}; QB: ${qbLocked}; after 60 s ${at60}; one out +${back}; in the end ${s.ar.receiver}`};
  });

  check('Franchise: a raid plays out the same every time from the same drops; 20 receivers knock the computer’s first lot flat (three stars, all its take), one alone does little; nothing can be dropped on or next to a building', () => {
    const base = F.botBase(1), loot = F.botLoot(F.BOTS[0], base, null, T0), box = F.boxOf(base);
    const B = makeBattle(base, loot, {receiver: 20});
    for (let i = 0; i < 20; i++) B.deploy('receiver', box.x0 - 1.5, box.y0 + i * .8);
    B.run(F.RAID_S);
    const R = replay(base, loot, {receiver: 20}, B.result().drops);
    const same = JSON.stringify(R.result()) === JSON.stringify(B.result());
    const one = makeBattle(base, loot, {receiver: 1});
    one.deploy('receiver', box.x0 - 1.5, box.y0);
    one.run(F.RAID_S);
    const st = base.b.find(b => b.t === 'stadium'), nb = makeBattle(base, loot, {receiver: 1}), blocked = !nb.canDrop(st.x + 1, st.y + 1) && !nb.deploy('receiver', st.x - .5, st.y + 1) && nb.canDrop(1, 1);
    const ok = B.stars() === 3 && B.got.cash === F.BOT_LOOT[0] && B.got.juice === F.BOT_LOOT[0] && same && one.stars() === 0 && one.pct() < 50 && blocked;
    return {pass: ok, detail: `20: ${B.stars()} stars ${B.pct()}% take ${JSON.stringify(B.got)} in ${B.t.toFixed(0)} s; replay same ${same}; one: ${one.stars()} stars ${one.pct()}%; next to the Stadium refused ${blocked}`};
  });

  check('Franchise: a raid is taken off the raided franchise once (what it took from storage, the booths’ and coolers’ piles, the trophies); the raided are shielded 12 hours, less if they raid someone; trophies move by stars', () => {
    const s = F.fresh(T0);
    s.r = {cash: 2000, juice: 2000};
    const booth = s.b.find(b => b.t === 'booth');
    booth.c = T0 - 5 * F.HOUR;
    const raid = {id: 'x1', vs: 'mason', from: 'evan', at: T0, st: 2, pc: 60, lt: [350, 300], ls: [300, 300], lb: {[booth.i]: [50, 0]}, ta: 21, td: -21};
    s.tp = 100;
    const a = F.applyRaids(s, [raid]).length, b = F.applyRaids(s, [raid]).length;
    const ok1 = a === 1 && b === 0 && s.r.cash === 1700 && s.r.juice === 1700 && s.tp === 79 && F.made(booth, T0) === 50;
    const sh = F.shieldOf('mason', [raid]) === T0 + 12 * F.HOUR;
    const broke = F.shieldOf('mason', [raid, {id: 'x2', vs: 'evan', from: 'mason', at: T0 + F.HOUR, st: 1}]) === T0 + F.HOUR;
    const none = F.shieldOf('mason', [Object.assign({}, raid, {st: 0})]) === 0;
    const tro = F.trophiesFor(3, 100, 100) === 30 && F.trophiesFor(0, 100, 100) === -15 && F.trophiesFor(1, 100, 500) === 17;
    return {pass: ok1 && sh && broke && none && tro, detail: `taken ${a} then ${b}; storage ${JSON.stringify(s.r)}; trophies ${s.tp}; booth left ${F.made(booth, T0)}; shield ${sh}, broken ${broke}, none at 0 stars ${none}; trophies ${tro}`};
  });

  check('Franchise (THE RULE): the franchises listed are the ones this phone may see (members and Ryan D everywhere; a guest’s, Ryan S’s, a row of no one’s only on their own phones, and every guest’s and app user’s on the owner’s); only the league’s can be raided, and only by the league; guests raid the computer’s', () => {
    const fr = tp => Object.assign(F.fresh(T0), {tp});
    const docs = [
      {id: 'fx-m', nick: 'Mason', fr1: fr(140)},
      {id: 'fx-rd', nick: 'Ryan Dow', g: true, fr1: fr(130)},
      {id: 'fx-rs', nick: 'Ryan Stewart', g: true, fr1: fr(120)},
      {id: 'fx-g', nick: 'Zed Q', g: true, fr1: fr(300)},
      {id: 'fx-x', nick: 'Setup test', fr1: fr(50)}
    ];
    const isRyanS = (data.user() || {}).id === 'ryan-stewart';
    const seen = owner => docs.filter(p => daily.boardShows(p, owner));
    const names = list => ranking(list, 'evan', null, T0).map(r => r.name).join(',');
    const member = names(seen(false)), owner = names(seen(true));
    const memberOk = member.includes('Mason') && member.includes('Ryan D') && !member.includes('Zed Q') && !member.includes('Setup') && member.includes('Ryan S') === isRyanS;
    const ownerOk = owner.includes('Zed Q') && owner.includes('Ryan S') && owner.includes('Mason') && !owner.includes('Setup');
    const mine = F.fresh(T0);
    const raidOwner = targets(T0, seen(true), 'evan', mine).people.map(x => x.k).sort().join(',');
    const raidGuest = targets(T0, seen(false), 'row:fx-me', mine);
    const keys = F.leagueKey('mason') && F.leagueKey('user:ryan-dow') && !F.leagueKey('user:ryan-stewart') && !F.leagueKey('row:fx-g');
    const ok = memberOk && ownerOk && raidOwner === 'mason,user:ryan-dow' && !raidGuest.league && !raidGuest.people.length && raidGuest.bots.length === 8 && keys;
    return {pass: ok, detail: `a member’s phone lists ${member}; the owner’s ${owner}; the owner can raid ${raidOwner}; a guest: league ${raidGuest.league}, ${raidGuest.people.length} people, ${raidGuest.bots.length} computer’s; keys ${keys}`};
  });

  check('Franchise (THE RULE): the Franchise reads the board as this phone may see it (daily.LB.raw), never every doc (LB.all)', async () => {
    const files = ['../views/franchise.js', '../views/franchise-raid.js', './franchise.js'];
    const src = await Promise.all(files.map(f => fetch(new URL(f, import.meta.url)).then(r => r.text())));
    const bad = files.filter((f, i) => /LB\.all\b/.test(src[i]));
    return {pass: !bad.length && src.every(t => t.length > 1000), detail: bad.length ? 'reads LB.all: ' + bad.join(', ') : 'LB.raw only'};
  });
}
