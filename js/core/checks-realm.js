// The Realm's checks for the dev gallery (#/_kit): that it's the owner's alone (the tab, the screens, the save, his
// own docs only, the computer's realms the only ones to attack or scout), scouting a realm, what the games pay, storage
// and the coffers, mines and farms, builders and the Keep's limits, training, an attack played out (the same every time), a dragon over walls,
// the computer's raids on the owner's realm, the cannon and the dragon hatchery, the art the buildings and folk are
// drawn from, and an old Franchise save taken up as a realm. checks.js imports
// realmChecks and calls it with its check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here
// writes to storage or the database.
import * as F from './realm.js';
import * as daily from './daily.js';
import * as data from './data.js';
import {makeBattle, replay, raidsDue, defend} from './realm-battle.js';

const T0 = Date.UTC(2026, 9, 21, 12);
const DAY = 24 * F.HOUR;

export async function realmChecks(check) {
  const [kk, rm, sv] = await Promise.all([import('./kick.js'), import('./return.js'), import('./seventeen.js').then(async m => { await m.load(); return m; })]);

  check('Realm: the owner’s alone: it plays only on his phones (realm.js mayPlay() is data.isOwner()); its tab shows only there, its screens are empty elsewhere and its save refuses; it reads only his own board docs, never LB.all, and attacks and scouts only the computer’s realms', async () => {
    const owner = !!data.isOwner();
    const [app, view, raid, scout] = await Promise.all([import('../app.js'), import('../views/realm.js'), import('../views/realm-raid.js'), import('../views/realm-scout.js')]);
    const may = F.mayPlay() === owner;
    const btn = document.querySelector('#tabbar .tab[data-tab="realm"]');
    const tab = app.ownerTab('realm') && app.TABS.includes('realm') === owner && !!btn && btn.hidden === !owner;
    const screens = [view.default, raid.default, scout.default].every(v => /rl-none/.test(v.render()) === !owner);
    const files = ['../views/realm.js', '../views/realm-raid.js', '../views/realm-scout.js', './realm.js', './realm-battle.js'];
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

  check('Realm: scouting (views/realm-scout.js, #/realm/scout/<realm>): each of the computer’s realms can be looked round before it’s attacked, the same lot and take the attack meets, its defenses counted, a building’s card saying what it does and holds, a defense’s reach drawn round it; looking changes nothing', async () => {
    const [app, view, scout] = await Promise.all([import('../app.js'), import('../views/realm.js'), import('../views/realm-scout.js')]);
    const r = app.__dev.parseRoute('/realm/scout/bot%3A4'), routed = !data.DATA || !data.isOwner() ? true : !!r && r.view === 'realm-scout' && r.open === 'cover';
    const s = F.fresh(T0), before = JSON.stringify(s);
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

  check('Realm: the games pay in Gold and Grain alike, a day each (the first finished across his phones; Return Man’s best run): Daily Puzzles 400 + 5 a point, 17–0 400 + 150 a win, Kick It 400 + 200 a make (to 15), Return Man 400 + 3 a yard (to 1,000)', () => {
    const a = {id: 'fx-a', nick: 'Evan', days: {10: {v: 4, p: 400, t: 2}}, kk1: {2: {m: 5, l: 40, y: 150, k: 8, t: 10}}, rm2: {1: {y: 300, l: 300, td: 3, t: 5}}, s17: {3: {w: 12, l: 5, p: 21.5, r: 0, k: '01234', t: 3}}};
    const b = {id: 'fx-b', nick: 'Evan', days: {10: {v: 4, p: 600, t: 5}, 11: {v: 4, p: 100, t: 6}}, kk1: {2: {m: 9, l: 48, y: 330, k: 12, t: 20}}, rm2: {1: {y: 900, l: 900, td: 9, t: 9}}};
    const inc = F.incomeOf([a, b], {kk, rm, sv});
    const want = {puzzles: 2400 + 900, '17-0': 400 + 150 * 12, kick: 400 + 200 * 5, return: 400 + 3 * 900};
    const ok = Object.entries(want).every(([g, v]) => inc.by[g] === v) && inc.total === Object.values(want).reduce((x, y) => x + y, 0);
    const cap = F.PAY.kick({m: 40}) === 3400 && F.PAY.return({y: 5000}) === 3400 && F.PAY['17-0']({w: 17}) === 400 + 150 * 17 + 500;
    return {pass: ok && cap, detail: `by ${JSON.stringify(inc.by)} total ${inc.total}; caps ${cap}`};
  });

  check('Realm: a new realm holds 2,500 of each in its Keep; the coffers keep what doesn’t fit (the games’ pay and the starter 1,500) and move it in as room opens; a gold mine digs 20 an hour up to 10 hours’ worth, collected as far as there’s room, and stops while it’s upgraded', () => {
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
    const ok = cap.gold === 2500 && cap.grain === 2500 && moved.gold === 2500 && pend.gold === 9000 && m3 === 60 && m30 === 200 && full === 0 && got === 60 && left === 0
      && up && during === 0 && after;
    return {pass: ok, detail: `cap ${JSON.stringify(cap)}, moved ${moved.gold}, waiting ${pend.gold}; mine 3h ${m3}, 30h ${m30}; full ${full}, then ${got} (left ${left}); upgrading ${up}, digging ${during}; after ${after}`};
  });

  check('Realm: one builder, one job at a time (the owner, Oct 2026): while anything’s going up or being upgraded nothing else can be, walls included (a new wall still goes up at once); no more huts, and a save with two is still one builder; the Keep’s level caps how many of each and how high (one gold mine at level 1, a ballista past level 2 needs Keep 2)', () => {
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
      && /Keep level 2/.test(mine) && /Keep level 2/.test(gate) && /Keep level 2/.test(wall) && !!wb && wb.l === 1 && wb.u === 0 && wUp === busy
      && built.l === 1 && balUp && after.every(w => w === busy);
    return {pass: ok, detail: `treasury ${!!built}; then: ${busy}; a hut: ${hut}; with 2 huts builders ${JSON.stringify(two)}, a granary: ${still}; mine: ${mine}; ballista 3: ${gate}; wall at 1: ${wall}; at 2: ${wb ? 'up at once' : 'no'}, its upgrade: ${wUp}; the treasury up ${built.l === 1}, the ballista upgraded ${balUp}, then: ${after.join(' / ')}`};
  });

  check('Realm: upgrades take time (the owner, Oct 2026): every level past the first takes longer than the one before (minutes at first, a day or two at the top); the Keep isn’t a level higher till its time’s up, and its builder’s busy till then; a wall’s upgrade takes time too (an hour or few at the top), the builder’s whole time', () => {
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
    return {pass: ok, detail: `too quick or not longer than the level before: ${slow.join(', ') || 'none'}; quickest top level ${Math.min(...tops) / 3600}h; Keep upgraded ${up} (${why}, ${free} builders free), a second before ${early}, at its time ${late}; a wall upgraded ${wUp}, a mine refused meanwhile ${busy}, ${wTime / 1000}s, then level ${w && w.l}`};
  });

  check('Realm: the base: everything stands inside it (EDGE tiles in from the lot’s sides) and nothing overlaps: building or moving onto taken ground, part of it, or off the base is refused, onto clear ground anywhere on it is fine; a save with two on the same ground (or one off the base) is laid out clear when it’s taken up', () => {
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
    return {pass: onKeep && off && corner && refused && moved && kept && clear(s.b), detail: `onto the Keep refused ${onKeep}; off the base refused ${off}; its corners fine ${corner}; a build on the Keep refused ${refused}; a move onto it refused, to a clear corner fine ${moved}; a save piled on the Keep and off the base: ${fixed ? `${fixed.b.length} of ${bad.b.length} kept, ${kept ? 'laid out clear, the Keep where it was' : 'NOT clear'}` : 'not taken up'}`};
  });

  check('Realm: room for everything (the owner, Oct 2026): the base is big enough that everything the top Keep allows takes up no more than half of it; a new realm and the computer’s are laid out round its middle; a save from the smaller lot (36 tiles) is moved over whole, into the middle of this one, once', () => {
    const B = F.N - 2 * F.EDGE, need = F.ORDER.reduce((t, k) => t + F.COUNT[k][F.MAX_KEEP - 1] * F.KINDS[k].size ** 2, 0);
    const room = need <= B * B / 2;
    const mid = s => { const k = s.b.find(b => b.t === 'keep'); return !!k && k.x + F.KINDS.keep.size / 2 === F.N / 2 && k.y + F.KINDS.keep.size / 2 === F.N / 2; };
    const centred = mid(F.fresh(T0)) && F.BOTS.every(b => mid(F.botBase(b.th)));
    const old = JSON.parse(JSON.stringify(F.fresh(T0))), by = (F.N - 36) / 2;
    delete old.n;
    old.b.forEach(b => { b.x -= by; b.y -= by; });
    const got = F.clean(old), again = got && F.clean(got);
    const moved = !!got && got.n === F.N && got.b.every((b, i) => b.x === old.b[i].x + by && b.y === old.b[i].y + by) && mid(got) && JSON.stringify(again) === JSON.stringify(got);
    return {pass: room && centred && moved, detail: `the base ${B}×${B} (${B * B} tiles), the top Keep’s lot ${need} (${Math.round(need / B / B * 100)}%); laid out round the middle ${centred}; an old save moved ${by} over, once ${moved}`};
  });

  check('Realm: the lands (Oct 2026): a realm starts on the coast; raising the Keep unlocks the Enchanted Forest (level 2), the Frozen Tundra (3), the Ocean Sanctuary (5), the Amber Desert (6) and the Infernal Wastes (7), each its to pick once open, never before; the pick is kept with the realm, and a save whose pick isn’t open (or isn’t one) lies on the coast', () => {
    const s = F.fresh(T0), keep = s.b.find(b => b.t === 'keep');
    const start = F.sceneryOf(s) === 'coast' && F.SCENERIES.filter(x => F.sceneryOpen(s, x.k)).map(x => x.k).join() === 'coast';
    const early = !F.pickScenery(s, 'tundra') && F.sceneryOf(s) === 'coast';
    const at = {};
    for (let l = 1; l <= F.MAX_KEEP; l++) { keep.l = l; F.SCENERIES.forEach(x => { if (at[x.k] == null && F.sceneryOpen(s, x.k)) at[x.k] = l; }); }
    const levels = at.coast === 1 && at.forest === 2 && at.tundra === 3 && at.ocean === 5 && at.desert === 6 && at.infernal === 7;
    keep.l = 5;
    const picked = F.pickScenery(s, 'ocean') && F.sceneryOf(s) === 'ocean' && !F.pickScenery(s, 'infernal') && F.sceneryOf(s) === 'ocean';
    const kept = F.sceneryOf(F.clean(JSON.parse(JSON.stringify(s)))) === 'ocean';
    const low = F.clean(Object.assign(JSON.parse(JSON.stringify(s)), {sc: 'infernal'})), junk = F.clean(Object.assign(JSON.parse(JSON.stringify(s)), {sc: 'moon'}));
    const fallback = F.sceneryOf(low) === 'coast' && junk.sc === '' && F.sceneryOf(junk) === 'coast';
    const back = F.pickScenery(s, 'coast') && F.sceneryOf(s) === 'coast' && s.sc === '';
    return {pass: start && early && levels && picked && kept && fallback && back, detail: `starts on the coast ${start}; the tundra at Keep 1 refused ${early}; unlocked at ${JSON.stringify(at)}; at Keep 5 the ocean picked, the wastes refused ${picked}; kept in the save ${kept}; a pick not open (or unknown) on the coast ${fallback}; back to the coast ${back}`};
  });

  check('Realm: the army trains one at a time with Grain (a footman 5 s at one barracks), into the war camps’ room; a full camp takes no more; one taken out of training gives its Grain back', () => {
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

  check('Realm: an attack plays out the same every time from the same drops; 20 footmen sack the computer’s first realm (three stars, all it holds), one alone does little; no one can be sent onto or next to a building', () => {
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
    return {pass: ok, detail: `20: ${B.stars()} stars ${B.pct()}% take ${JSON.stringify(B.got)} in ${B.t.toFixed(0)} s; replay same ${same}; one: ${one.stars()} stars ${one.pct()}%; next to the Keep refused ${blocked}`};
  });

  check('Realm: a dragon flies over the walls (it never stops to break one) and the trebuchet and pitch cauldron can’t touch it, though they hit a knight; a ballista can', () => {
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

  check('Realm: the cannon and the dragon hatchery (Oct 2026): a cannon’s crew hits a footman but never a dragon; a dragon trains only with a hatchery, a level of it each dragon’s room; a cannon saved now stays a cannon (only an old Franchise save’s cannons are ballistas)', () => {
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

  check('Realm: the art (tools/realm/sprites.py): the Keep, gold mines, archer towers and hatcheries drawn from their pictures, ten each, every level a picture of its own (the top level the grandest); every villager, archer and cannon crew a building calls for has all its poses; the pictures are there', async () => {
    const S = await import('../views/realm-sprites.js');
    const bad = [];
    S.KINDS.forEach(k => {
      const fr = S.BUILD[k] && S.BUILD[k].f, used = new Set();
      for (let l = 1; l <= F.maxLevel(k); l++) used.add(S.frameOf(k, l));
      if (!fr || fr.length !== 10 || used.size !== Math.min(10, F.maxLevel(k)) || S.frameOf(k, F.maxLevel(k)) !== 9 || fr.some(f => f.length !== 7 || f[2] < 50 || f[3] < 50)) bad.push(k);
    });
    const sheets = new Set();
    F.ORDER.forEach(k => { for (let l = 1; l <= F.maxLevel(k); l++) ['ok', 'up'].forEach(st => S.crewOf({i: 1, t: k, l}, st, F.KINDS[k].size).forEach(c => sheets.add(c.sheet))); });
    const missing = [...sheets].filter(n => !S.FOLK[n] || ![4, 8].includes(S.FOLK[n].length));
    const plat = Array.from({length: 10}, (_, i) => S.platform(i + 1)).every((p, i) => p && p[0] > 0 && p[0] < S.BUILD.tower.f[i][2] && p[1] > 0 && p[1] < S.BUILD.tower.f[i][3]);
    const files = await Promise.all([...S.KINDS, 'folk'].map(n => fetch(new URL(`../../img/realm/${n}.webp`, import.meta.url), {method: 'HEAD'}).then(r => r.ok ? '' : n, () => n)));
    const gone = files.filter(Boolean);
    return {pass: !bad.length && !missing.length && plat && !gone.length && sheets.size >= 20, detail: `buildings ${bad.length ? 'wrong: ' + bad.join(', ') : S.KINDS.join(', ') + ' ok'}; ${sheets.size} folk sheets called for${missing.length ? ', missing ' + missing.join(', ') : ''}; tower platforms ${plat}; ${gone.length ? 'pictures missing: ' + gone.join(', ') : 'pictures there'}`};
  });

  check('Realm: the scenery (tools/realm/sceneries.py; img/realm/scenery/: every land a blank portrait landscape, the owner’s, Oct 2026): every land has its layout, tall, and its landscape (and any picture placed on it) is there; nothing’s placed in its build zone, its lot lies inside it, and the zone inside the landscape', async () => {
    const D3 = await import('../views/realm-3d.js'), out = [];
    let pass = F.SCENERIES.every(x => D3.FILES[x.k] && D3.FILES[x.k].tall);
    for (const [shape, file] of Object.entries(D3.FILES).flatMap(([k, f]) => Object.entries(f).map(([sh, fl]) => [`${k} ${sh}`, fl]))) {
      const lay = await fetch(new URL(`../../img/realm/scenery/${file}`, import.meta.url)).then(r => r.json(), () => null);
      if (!lay) { pass = false; out.push(`${shape}: no layout`); continue; }
      const A = lay.assets, bg = lay.scene.background_asset_id, Z = lay.build_zone_polygon, L = lay.lot;
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

  check('Realm: the army’s pictures (tools/realm/army.py, img/realm/army/): the Footman, Archer, Knight, Thief and Dragon each drawn from his (where he stands inside it, a way he faces, a size: the Dragon bigger than any man, and in the air); the Sapper has none and stays in 3D; the pictures are there', async () => {
    const meta = await fetch(new URL('../../img/realm/army/army.json', import.meta.url)).then(r => r.json(), () => null);
    if (!meta) return {pass: false, detail: 'no army.json'};
    const want = F.TROOP_ORDER.filter(t => t !== 'sapper'), bad = want.filter(t => { const m = meta[t]; return !m || !(m.w > 50 && m.h > 50) || !(m.ax >= 0 && m.ax <= m.w && m.ay >= 0 && m.ay <= m.h) || typeof m.right !== 'boolean' || !(m.fly ? m.wide > 0 : m.tall > 0); });
    const files = await Promise.all(want.map(t => fetch(new URL(`../../img/realm/army/${t}.webp`, import.meta.url), {method: 'HEAD'}).then(r => (r.ok ? '' : t), () => t)));
    const gone = files.filter(Boolean), men = want.filter(t => t !== 'dragon').map(t => meta[t] && meta[t].tall * meta[t].w / meta[t].h);
    const big = !!meta.dragon && meta.dragon.fly && meta.dragon.wide > Math.max(...men) * 2 && men.every(w => w > 0);
    const pass = !bad.length && !gone.length && !meta.sapper && big && want.every(t => !meta[t] || !!meta[t].fly === !!F.TROOPS[t].fly);
    return {pass, detail: `${bad.length ? 'wrong: ' + bad.join(', ') : want.join(', ') + ' ok'}; the sapper ${meta.sapper ? 'HAS one' : 'in 3D'}; the dragon ${big ? 'bigger, flying' : 'WRONG'}; ${gone.length ? 'missing: ' + gone.join(', ') : 'pictures there'}`};
  });

  check('Realm: the computer’s realms raid his realm (at most one each half day, the last two while he was away; none in its first day, before Keep level 2 or during a truce): played the same every time, taken off his stores and glory once, never his coffers', () => {
    const born = T0 - 3 * DAY;
    const small = F.fresh(born), none = defend(small, T0), skipped = !none.length && small.lr === T0;
    const s = F.fresh(born);
    s.b.find(b => b.t === 'keep').l = 2;
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
    young.b.find(b => b.t === 'keep').l = 2;
    const firstDay = raidsDue(young, T0).length === 0;
    const calm = F.clean(before);
    calm.sh = T0 + F.HOUR;
    const inTruce = !defend(calm, T0).length && calm.lr === due[due.length - 1];
    return {pass: ok1 && skipped && firstDay && inTruce, detail: `Keep 1: none ${skipped}; due ${due.length}, played ${done.length} (${done.map(r => `${r.by} ${r.st}★ ${r.pc}% took ${r.lt.join('/')}`).join('; ')}), again ${again.length}; the same twice ${same}; stores ${JSON.stringify(s.r)} ok ${stores}; glory ${s.tp} ok ${glory}; truce ${truced}; coffers untouched ${JSON.stringify(F.pending(s, 5000)) === coffers}; first day none ${firstDay}; in a truce none ${inTruce}`};
  });

  check('Realm: his old Franchise save is taken up as his realm (Stadium to Keep, booths to gold mines, coolers to farms, cannons to ballistas, fences to walls; Cash to Gold, Juice to Grain; receivers to footmen, kickers to dragons), the same twice, and raids on people dropped', () => {
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
    return {pass: ok && twice && keptNew, detail: s ? `${kinds}; Keep ${F.keepOf(s)}; stored ${JSON.stringify(s.r)}, coffers taken ${JSON.stringify(s.cl)}, besides ${JSON.stringify(s.xo)}; army ${JSON.stringify(s.ar)}, training ${JSON.stringify(s.q)}; raids kept ${s.rd.map(r => r.vs).join(',')}; the same twice ${twice}; a new realm as it was ${keptNew}` : 'not taken up'};
  });
}
