// Press Room checks for the dev gallery (#/_kit): js/core/press.js (YouTube links, player URLs, the seeded archive
// and its merge under the Firestore docs, contexts, the post sheet's weeks, writes on the stand-in, counts) and
// the pressers rules block. checks.js (owner: core) imports pressChecks and calls it with its own check(name, fn)
// helper; every fn returns true or {pass, detail}. Nothing here writes to the real database: post()/remove() run
// only on the dev stand-in, inside press.__dev.sandbox (an in-memory store: localStorage and other tabs are never
// touched). The only reads are the repo's own data/pressers.json and firestore.rules.
// Owner: PRESS-CORE.

import * as data from './data.js';
import * as press from './press.js';
import * as week from './week.js';

const V = 'dQw4w9WgXcQ', J = 'cY_ifzuuk3s', S = 'abcDEF12_-x';

// [input, vid (null = rejected), tall]
const LINKS = [
  ['https://youtu.be/dQw4w9WgXcQ', V],
  ['https://youtu.be/dQw4w9WgXcQ?si=x', V],
  ['youtu.be/dQw4w9WgXcQ', V],
  ['youtu.be/dQw4w9WgXcQ/', V],
  ['https://youtu.be/cY_ifzuuk3s?si=Ab12Cd34Ef56Gh78', J],
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', V],
  ['https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ', V],
  ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', V],
  ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=youtu.be', V],
  ['https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=x', V],
  ['www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx9&index=2', V],
  ['http://youtube.com/watch?v=dQw4w9WgXcQ#t=30', V],
  ['HTTPS://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ', V],
  ['https://www.youtube.com/watch?feature=share&amp;v=dQw4w9WgXcQ', V],
  ['https://youtube.com/shorts/abcDEF12_-x?si=x', S, true],
  ['https://www.youtube.com/shorts/abcDEF12_-x/', S, true],
  ['https://www.youtube.com/live/dQw4w9WgXcQ?feature=share', V],
  ['https://www.youtube.com/embed/dQw4w9WgXcQ?start=10', V],
  ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', V],
  ['https://www.youtube.com/v/dQw4w9WgXcQ?version=3', V],
  ['dQw4w9WgXcQ', V],
  ['  https://youtu.be/dQw4w9WgXcQ  \n', V],
  ['Check this out https://youtu.be/cY_ifzuuk3s?si=abc', J],
  ["Jackson's presser (https://youtu.be/cY_ifzuuk3s).", J],
  ['Watch Mitch squirm: youtube.com/shorts/abcDEF12_-x', S, true],
  ['https://studio.youtube.com/video/dQw4w9WgXcQ/edit', V],           // Studio's address bar after an upload
  ['https://youtu.be/dQw4w9WgXcQ…', V],                           // a chat app's trailing ellipsis
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ​', V],            // a zero-width space
  ['https://youtube.com/watch?v=dQw4w9WgXcQ?si=x', V],                 // a second '?' after the id
  ['https://WWW.YOUTUBE.COM/WATCH?V=dQw4w9WgXcQ', V],                  // upper-case path and key
  ['https://studio.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw', null],
  ['https://www.youtube.com/watch?v=dQw4w9WgX$Q', null],
  ['https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', null],
  ['https://www.youtube.com/watch?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', null],
  ['https://www.youtube.com/@RickAstleyYT', null],
  ['https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw', null],
  ['https://www.youtube.com/embed/videoseries?list=PLx9', null],
  ['https://youtu.be/dQw4w9WgXc', null],
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQQ', null],
  ['dQw4w9WgX$Q', null],
  ['https://vimeo.com/123456789', null],
  ['https://notyoutube.com/watch?v=dQw4w9WgXcQ', null],
  ['https://www.youtube.com/', null],
  ['https://youtube.com/shorts/', null],
  ['hello there', null],
  ['', null],
  [null, null]
];

const iso = s => Date.parse(s);
const keys = list => list.map(p => p.key).join(' ');

export async function pressChecks(check) {
  let err = null;
  try { await data.load(); } catch (e) { err = e; }
  const need = () => { if (err) throw new Error('league did not load: ' + (err.message || err)); };

  // 1. Links
  check(`Press Room: parseYouTube reads ${LINKS.filter(x => x[1]).length} link shapes and rejects ${LINKS.filter(x => !x[1]).length} others`, () => {
    const bad = LINKS.filter(([input, vid, tall]) => {
      const r = press.parseYouTube(input);
      return vid ? !(r && r.vid === vid && r.tall === !!tall) : r !== null;
    });
    return {pass: !bad.length, detail: bad.length ? 'wrong: ' + bad.map(x => JSON.stringify(x[0]) + ' -> ' + JSON.stringify(press.parseYouTube(x[0]))).join('; ') : `${LINKS.length} inputs as expected (shorts are tall)`};
  });

  // 2. Player and thumbnail URLs, oEmbed answers
  check('Press Room: player, thumbnail and watch URLs; oEmbed statuses map to private / missing / offline', async () => {
    const urls = press.thumbURL(V) === 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
      && press.embedURL(V) === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0'
      && press.watchURL(V) === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const R = press.lookupReason;
    const codes = R(200) === null && R(401) === 'private' && R(403) === 'private' && R(400) === 'missing' && R(404) === 'missing'
      && R(500) === 'offline' && R(429) === 'offline';
    const short = await press.lookup('abc'); // never fetched: not an id
    const noId = short && short.ok === false && short.reason === 'missing';
    return {pass: urls && codes && noId, detail: `urls ${urls}, statuses ${codes}, bad id -> ${JSON.stringify(short)}`};
  });

  // 2b. Google Drive files (Nov 11 2026): a seeded presser's Drive file plays in Drive's player ahead of its YouTube
  // video, a Drive-only week is valid, and only the seed carries Drive ids.
  check('Press Room: a seeded Drive file plays first (thumbnail, player, link), a Drive-only seed week is valid, Firestore docs never carry Drive ids', () => {
    const D = '1RxzyQ7M2mTpNHELvjReHhDBUvIIsZzIp';
    const both = press.normalize({vid: V, drive: D, who: 'ben'}, '2026-w3', 'seed');
    const only = press.normalize({drive: D, who: 'jayton', tall: true}, '2026-w8', 'seed');
    const remote = press.normalize({vid: V, drive: D, who: 'ben'}, '2026-w3', 'remote');
    const remoteOnly = press.normalize({drive: D, who: 'ben'}, '2026-w3', 'remote');
    const bad = press.normalize({drive: 'short', who: 'ben'}, '2026-w3', 'seed');
    const drv = !!both && both.drive === D && both.vid === V && press.playable(both)
      && press.thumbOf(both) === `https://drive.google.com/thumbnail?id=${D}&sz=w640`
      && press.playerOf(both) === `https://drive.google.com/file/d/${D}/preview`
      && press.openOf(both).url === `https://drive.google.com/file/d/${D}/view` && /Drive/.test(press.openOf(both).label);
    const solo = !!only && only.vid === null && only.drive === D && only.tall === true && press.playable(only);
    const yt = !!remote && remote.drive === null && press.playerOf(remote) === press.embedURL(V) && /YouTube/.test(press.openOf(remote).label);
    // A video in the app (Nov 12 2026) wins over Drive and YouTube, has no "open elsewhere" link, and only the seed has one.
    const F = 'video/press/2026-w3-ben-v1.mp4';
    const own = press.normalize({vid: V, drive: D, file: F, who: 'ben'}, '2026-w3', 'seed');
    const ownRemote = press.normalize({vid: V, file: F, who: 'ben'}, '2026-w3', 'remote');
    const badFile = press.normalize({file: '../x.mp4', who: 'ben'}, '2026-w3', 'seed');
    const file = !!own && own.file === F && press.playable(own) && press.playerOf(own).endsWith('/' + F)
      && press.thumbOf(own).endsWith('/video/press/2026-w3-ben-v1.jpg') && press.openOf(own) === null
      && !!ownRemote && ownRemote.file === null && badFile === null;
    const pass = drv && solo && yt && file && remoteOnly === null && bad === null && !press.playable({vid: null, drive: null});
    return {pass, detail: `drive first ${drv}, drive only ${solo}, firestore YouTube only ${yt}, app file first ${file}, firestore drive-only ${JSON.stringify(remoteOnly)}, bad id ${JSON.stringify(bad)}`};
  });

  // 3. Docs -> list
  check('Press Room: list keeps valid docs only (bad vid, unknown manager, bad key dropped), newest first; Firestore beats the seed, the stand-in beats both', () => {
    need();
    const seed = [{key: '2026-w2', vid: J, who: 'jackson', title: '', tall: false}, {key: '2026-w5', vid: J, who: 'sayer'}];
    const remote = [
      {key: '2026-w1', vid: V, who: 'evan', title: '  Evan   speaks ', nick: 'Ev', me: 'evan', at: {seconds: 1790000000, nanoseconds: 5e6}},
      {key: '2026-w3', vid: 'short', who: 'ben'},              // bad vid
      {key: '2026-w4', vid: V, who: 'nobody'},                 // unknown manager
      {key: '2026-4', vid: V, who: 'ben'},                     // bad key
      {key: '2026-w18', vid: V, who: 'ben'},                   // past week 17
      {key: '2025-w12', vid: J, who: 'mitch', tall: true, me: 'ghost', nick: 42},
      {key: '2026-w2', vid: V, who: 'john', nick: 'John'}      // replaces the seed
    ];
    const local = {'2026-w5': null, '2025-w12': null, '2026-w6': {vid: V, who: 'corbin', at: 5, nick: 'Dev'}, 'junk': {vid: V, who: 'ben'}};
    const list = press.mergeLayers(seed, remote, local);
    const order = keys(list) === '2026-w6 2026-w5 2026-w2 2026-w1';
    const by = Object.fromEntries(list.map(p => [p.key, p]));
    const w1 = by['2026-w1'], w2 = by['2026-w2'], w5 = by['2026-w5'], w6 = by['2026-w6'];
    const fields = w1.title === 'Evan speaks' && w1.at === 1790000000005 && w1.me === 'evan' && w1.nick === 'Ev' && !w1.seed && !w1.dev
      && w1.year === 2026 && w1.week === 1 && w1.vid === V && w1.tall === false && w1.ctx && w1.ctx.opp === 'corbin' && w1.ctx.lost
      && w2.who === 'john' && !w2.seed && w5.seed && w5.nick === '' && w5.at === null && w5.me === null && w6.dev && w6.at === 5;
    // Removing the Firestore doc of a seeded week shows the seed again; without the stand-in, 2025 week 12 is back.
    const back = press.mergeLayers(seed, remote, {'2026-w2': null});
    const seedAgain = back.find(p => p.key === '2026-w2');
    const w12 = back.find(p => p.key === '2025-w12');
    const revert = !!seedAgain && seedAgain.seed && seedAgain.who === 'jackson' && seedAgain.vid === J
      && !!w12 && w12.tall === true && w12.me === null && w12.nick === '' && keys(back) === '2026-w5 2026-w2 2026-w1 2025-w12';
    // Titles: whitespace collapsed, at most 80 characters, an emoji at the cut is never split.
    const long = press.normalize({vid: V, who: 'ben', title: 'x'.repeat(79) + '🎙️ and more'}, '2026-w3');
    const titles = long.title === 'x'.repeat(79) && press.normalize({vid: V, who: 'ben', title: 7}, '2026-w3').title === '';
    const nulls = press.normalize(null, '2026-w1') === null && press.normalize({vid: V, who: 'constructor'}, '2026-w1') === null;
    return {pass: order && fields && revert && titles && nulls, detail: `order ${keys(list)}; fields ${fields}; remove on a seeded week -> ${keys(back)}; titles ${titles}`};
  });

  // 4. Context lines
  check('Press Room: context() and line() on played 2026 weeks ("Week 3 · lost 104.28–164.06 to Corbin")', () => {
    need();
    const c2 = press.context(2026, 2, 'jackson');
    const one = c2 && c2.opp === 'john' && c2.sa === 73.94 && c2.sb === 106.58 && c2.lost === true && c2.tie === false && c2.type === 'reg';
    const l3 = press.line({year: 2026, week: 3, ctx: press.context(2026, 3, 'jackson')});
    const w3 = press.line({year: 2026, week: 3, ctx: press.context(2026, 3, 'corbin')});
    const y3 = press.line({year: 2026, week: 3, ctx: press.context('2026', '3', 'jackson')}, {year: true});
    const tieG = data.GAMES.find(g => g.tie);
    const tie = !tieG || /· tied /.test(press.line({year: tieG.year, week: tieG.week, ctx: press.context(tieG.year, tieG.week, tieG.a)}));
    const next = data.throughWeek(2026) + 1;
    const unplayed = next > press.MAX_WEEK || press.context(2026, next, 'jackson') === null;
    const none = press.context(2026, 2, 'nobody') === null && press.line({year: 2026, week: 4, ctx: null}) === 'Week 4';
    const pass = one && l3 === 'Week 3 · lost 104.28–164.06 to Corbin' && w3 === 'Week 3 · beat Jackson 164.06–104.28'
      && y3 === 'Week 3, 2026 · lost 104.28–164.06 to Corbin' && tie && unplayed && none;
    return {pass, detail: `${l3} | ${w3} | week ${next}: ${unplayed ? 'no context yet' : 'has one?'}${tieG ? '' : ' | no tie in the data'}`};
  });

  // 5. The post sheet's weeks
  check('Press Room: defaultWeek is the latest finished week without a presser (fixed dates, 2026); weekOptions', () => {
    need();
    const P = (w, y = 2026) => ({year: y, week: w, key: week.weekKey(y, w)});
    const D = (at, list) => { const r = press.defaultWeek(iso(at), {year: 2026, list}); return r.year === 2026 ? r.week : 'year ' + r.year; };
    const got = [
      D('2026-09-05T12:00Z', []),                    // before week 1's lock -> 1
      D('2026-10-06T16:00Z', []),                    // Tuesday after week 4's games -> 4
      D('2026-10-06T16:00Z', [P(2)]),                // ... with the seed (week 2) -> 4
      D('2026-09-29T16:00Z', [P(2)]),                // today: week 3 has none yet -> 3
      D('2026-10-02T16:00Z', [P(2)]),                // Friday, week 4 being played, week 3 still missing -> 3
      D('2026-10-02T16:00Z', [P(2), P(3)]),          // ... week 3 posted -> 4 (the week whose lock passed)
      D('2026-10-06T16:00Z', [P(2), P(4)]),          // a gap: week 3 -> 3
      D('2026-10-06T16:00Z', [P(2), P(3), P(4)]),    // all posted -> 4
      D('2026-10-06T16:00Z', [P(3, 2025)]),          // other seasons don't count -> 4
      D('2027-01-20T12:00Z', [])                     // after the season -> 17
    ].join(',');
    const want = '1,4,4,3,3,4,3,4,4,17';
    const lw = press.latestWeek(iso('2026-10-02T00:14Z'), 2026).week === 3 && press.latestWeek(iso('2026-10-02T00:15Z'), 2026).week === 4
      && press.latestWeek(iso('2026-11-26T17:31Z'), 2026).week === 12;  // Thanksgiving: 12:30 PM Eastern
    const over = !press.weekOver(2026, 4, iso('2026-10-06T08:59Z')) && press.weekOver(2026, 4, iso('2026-10-06T09:00Z'));
    const past = data.SEASONS.find(s => !s.live);
    const opts = press.weekOptions(past ? past.year : 0);
    const live = press.seasonYear();
    const liveOpts = press.weekOptions(live, iso('2026-09-29T16:00Z')).join();
    const liveWant = live === 2026 ? '1,2,3' : Array.from({length: 17}, (_, i) => i + 1).join();
    const optsOk = (!past || (opts.length === 17 && opts[0] === 1 && opts[16] === 17)) && liveOpts === liveWant && press.weekOptions(1999).length === 0;
    const pass = got === want && lw && over && optsOk;
    return {pass, detail: `got ${got} (want ${want}); lock/over ${lw && over}; ${live} options on Sep 29: ${liveOpts}; ${past ? past.year : 'no past season'}: ${opts.length} weeks`};
  });

  // 6. Counts
  check('Press Room: stats() counts pressers per manager, most first', () => {
    need();
    const list = press.mergeLayers([], [
      {key: '2026-w1', vid: V, who: 'mitch'}, {key: '2026-w3', vid: V, who: 'mitch'}, {key: '2025-w9', vid: V, who: 'mitch'},
      {key: '2026-w2', vid: J, who: 'jackson'}, {key: '2025-w4', vid: V, who: 'ben'}, {key: '2025-w5', vid: V, who: 'ben'}
    ], {});
    const s = press.stats(list);
    const top = s.top.map(x => `${x.id}:${x.n}:${x.latest}`).join(' ');
    const pass = s.total === 6 && s.byManager.mitch === 3 && s.byManager.ben === 2 && s.byManager.jackson === 1
      && top === 'mitch:3:2026-w3 ben:2:2025-w5 jackson:1:2026-w2' && press.stats([]).total === 0;
    return {pass, detail: top};
  });

  // 7. Writes (stand-in only)
  check('Press Room: post() and remove() validate first and return the right codes (dev stand-in, in memory)', async () => {
    need();
    if (!press.__dev.standIn()) return {pass: true, detail: 'skipped: this page can write to the real database'};
    await press.loadSeed();
    const before = JSON.stringify(press.__dev.store());
    const out = [];
    let pass = true;
    const expect = (label, got, want) => { out.push(`${label} ${got}`); if (got !== want) { pass = false; out.push(`(want ${want})`); } };
    press.__dev.sandbox(true);
    try {
      const ok = {year: 2026, week: 9, vid: V, who: 'ben', title: '  Ben   faces the media ', tall: false};
      expect('null', await press.post(null), 'invalid');
      expect('week 0', await press.post(Object.assign({}, ok, {week: 0})), 'invalid');
      expect('week 18', await press.post(Object.assign({}, ok, {week: 18})), 'invalid');
      expect('year 1999', await press.post(Object.assign({}, ok, {year: 1999})), 'invalid');
      expect('short id', await press.post(Object.assign({}, ok, {vid: 'abc'})), 'invalid');
      expect('a link', await press.post(Object.assign({}, ok, {vid: 'https://youtu.be/' + V})), 'invalid');
      expect('nobody', await press.post(Object.assign({}, ok, {who: 'nobody'})), 'invalid');
      expect('title 5', await press.post(Object.assign({}, ok, {title: 5})), 'invalid');
      expect('tall "yes"', await press.post(Object.assign({}, ok, {tall: 'yes'})), 'invalid');
      expect('post', await press.post(ok), 'dev');
      let p = press.__dev.snapshot().byKey['2026-w9'];
      const saved = !!p && p.who === 'ben' && p.vid === V && p.title === 'Ben faces the media' && p.dev && !p.seed && typeof p.at === 'number' && typeof p.nick === 'string';
      if (!saved) { pass = false; out.push('(saved doc wrong)'); }
      expect('replace', await press.post(Object.assign({}, ok, {vid: J, title: 'y'.repeat(100), tall: true})), 'dev');
      const list = press.__dev.snapshot().list.filter(x => x.key === '2026-w9');
      p = list[0];
      if (!(list.length === 1 && p.vid === J && p.title.length === 80 && p.tall)) { pass = false; out.push('(replace wrong)'); }
      expect('remove', await press.remove('2026-w9'), 'dev');
      if (press.__dev.snapshot().byKey['2026-w9']) { pass = false; out.push('(still there)'); }
      expect('remove bad key', await press.remove('week 3'), 'invalid');
      // A seeded week: Remove is refused; Replace works, and removing the replacement shows the seed again.
      const seeded = press.__dev.snapshot().list.find(x => x.seed);
      if (seeded) {
        expect('remove seed', await press.remove(seeded.key), 'invalid');
        expect('replace seed', await press.post({year: seeded.year, week: seeded.week, vid: V, who: seeded.who}), 'dev');
        const r = press.__dev.snapshot().byKey[seeded.key];
        if (!(r && !r.seed && r.vid === V)) { pass = false; out.push('(seed not replaced)'); }
        expect('remove replacement', await press.remove(seeded.key), 'dev');
        const back = press.__dev.snapshot().byKey[seeded.key];
        if (!(back && back.seed && back.vid === seeded.vid)) { pass = false; out.push('(seed not back)'); }
      } else out.push('(no seed loaded: seed steps skipped)');
      press.__dev.fail('denied');
      expect('denied', await press.post(ok), 'denied');
      press.__dev.fail('failed');
      expect('failed', await press.post(ok), 'failed');
      expect('invalid first', await press.post(Object.assign({}, ok, {vid: 'x'})), 'invalid');
    } finally {
      press.__dev.sandbox(false);
    }
    const after = JSON.stringify(press.__dev.store());
    if (after !== before) { pass = false; out.push('(the real stand-in changed)'); }
    return {pass, detail: out.join(', ')};
  });

  // 8. Shared listener
  check('Press Room: subscribers share one listener and one payload; the seed is in the list', async () => {
    need();
    const seedR = await press.loadSeed();
    const st0 = press.__dev.state();
    const got = [];
    const u1 = press.subscribePressers(p => got.push(['a', p]));
    const u2 = press.subscribePressers(p => got.push(['b', p]));
    const mid = press.__dev.state();
    await new Promise(r => setTimeout(r, 0));
    u1(); u2(); u1();
    const st1 = press.__dev.state();
    const a = got.find(x => x[0] === 'a'), b = got.find(x => x[0] === 'b');
    const shape = !!a && !!b && a[1].list === b[1].list && Array.isArray(a[1].list) && typeof a[1].ready === 'boolean'
      && 'error' in a[1] && a[1].dev === press.__dev.standIn() && a[1].byKey && Object.getPrototypeOf(a[1].byKey) === null;
    const counts = mid.subscribers === st0.subscribers + 2 && st1.subscribers === st0.subscribers;
    const want = st0.noSeed ? [] : (seedR.docs || []).map(d => d.key);
    const hasSeed = want.every(k => a && a[1].byKey[k]);
    return {pass: shape && counts && hasSeed, detail: `payload shared ${shape}; subscribers ${st0.subscribers} -> ${mid.subscribers} -> ${st1.subscribers}; seed ${want.join(' ') || 'ignored/empty'} in the list ${hasSeed}`};
  });

  // 8b. The Media Room (League › Media until Nov 24 2026): data/media.json's Happy Meals, every entry a manager's (or
  // two) Drive file, keys unique; the Media Room's case on the shelf and its route, League's old Media link sent there.
  check('Media Room: data/media.json lists every Happy Meal as a valid Drive file of known managers, keys unique, and the draft order their times set; its case opens #/puzzles/media and League has no Media segment', async () => {
    const [res, mod, lg, gm, mv] = await Promise.all([
      fetch(new URL('../../data/media.json', import.meta.url).href, {cache: 'no-cache'}),
      import('./media.js'),
      import('../views/league.js'),
      import('../views/games.js'),
      import('../views/media.js')
    ]);
    if (!res.ok) return {pass: false, detail: 'HTTP ' + res.status};
    const j = await res.json();
    const raw = j && Array.isArray(j.happyMeals) ? j.happyMeals : [];
    const kept = mod.mealsOf(j);
    const keys = new Set(raw.map(m => m && m.key));
    const allWho = raw.every(m => m && Array.isArray(m.who) && m.who.length && m.who.every(id => data.M[id]));
    const tall = raw.every(m => typeof m.tall === 'boolean');
    // Nov 12 2026: every Happy Meal plays from the app (video/media/…mp4), its Drive file kept as the record.
    const files = raw.every(m => typeof m.file === 'string' && kept.some(k => k.key === m.key && k.file === m.file))
      && mod.mealsOf({happyMeals: [{key: 'z', who: ['ben'], drive: '1RxzyQ7M2mTpNHELvjReHhDBUvIIsZzIp', file: '../x.mp4'}]})[0].file === null;
    const seg = lg.segPath('media') === '/league/standings' && gm.gamePath('media') === '/puzzles/media'
      && gm.GAMES.some(g => g.id === 'media' && g.art && g.book && g.disc) && gm.gamesFor(null).some(g => g.id === 'media');
    // every Happy Meal in the Media Room, in draft order (the shared video by its first pick)
    const cat = mv.__dev.catalogue({list: [], meals: kept, draft: mod.draftOf(j)});
    const room = cat.meals.length === kept.length && cat.meals.every((x, i) => !i || x.pick >= cat.meals[i - 1].pick) && cat.meals[0].pick === 1;
    const junk = mod.mealsOf({happyMeals: [{key: 'x', who: ['nobody'], drive: '1RxzyQ7M2mTpNHELvjReHhDBUvIIsZzIp'}, {key: 'y', who: ['ben'], drive: 'short'}]}).length === 0;
    // Nov 24 2026: the draft order the Happy Meals set: every manager once, picks 1..n, each time its raw time plus its
    // penalties and credits, and the fastest picking first (ties in the draft's own order).
    const dr = mod.draftOf(j), sec = t => { const m = /^(\d+):(\d\d)$/.exec(t); return m ? +m[1] * 60 + +m[2] : NaN; };
    const dt = dr ? dr.times : [];
    const draftOk = !!dr && dt.length === data.ids.length && new Set(dt.map(t => t.who)).size === dt.length
      && dt.every((t, i) => t.pick === i + 1) && dt.every(t => t.note || sec(t.raw) + t.adj.reduce((x, a) => x + a[0], 0) === sec(t.time))
      && dt.every((t, i) => !i || sec(t.time) >= sec(dt[i - 1].time))
      && (j.draft.times || []).length === dt.length;
    const pass = raw.length > 0 && kept.length === raw.length && keys.size === raw.length && allWho && tall && files && seg && room && junk && draftOk;
    return {pass, detail: `${kept.length}/${raw.length} kept; keys unique ${keys.size === raw.length}; managers ${allWho}; tall ${tall}; app files ${files}; case and route ${seg}; Media Room in draft order ${room}; junk dropped ${junk}; draft order ${draftOk} (${dt.map(t => `${t.pick}. ${data.name(t.who)} ${t.time}`).join(', ')})`};
  });

  // 9. Seed file
  check('Press Room: the seed file (data/pressers.json) parses and every entry (pressers, chat MOTW picks, chat questions) is valid', async () => {
    need();
    const res = await fetch(new URL('../../data/pressers.json', import.meta.url).href, {cache: 'no-cache'});
    if (!res.ok) return {pass: false, detail: 'HTTP ' + res.status};
    const j = await res.json();
    const list = j && j.pressers;
    if (!Array.isArray(list)) return {pass: false, detail: 'no "pressers" list'};
    if (Object.keys(j).some(k => !['pressers', 'motw', 'questions', 'noShows'].includes(k))) return {pass: false, detail: 'unknown top-level key'};
    const allowed = new Set(['key', 'vid', 'drive', 'file', 'who', 'title', 'tall']);
    const bad = [], seen = new Set();
    // Matchups of the Week picked in the chat: two different managers who played each other that week (once the
    // week is in the data), one entry per week.
    const motw = j.motw == null ? [] : j.motw;
    const mseen = new Set();
    if (!Array.isArray(motw)) bad.push('"motw" is not a list');
    else motw.forEach((m, i) => {
      const P = m && week.parseKey(m.key);
      const one = P ? press.seedMotw([m])[week.weekKey(P.year, P.week)] : null;
      const why = !m || typeof m !== 'object' || Object.keys(m).some(k => !['key', 'a', 'b'].includes(k)) ? 'bad entry'
        : !one ? 'bad key or managers'
        : P.week <= data.throughWeek(P.year) && !week.resultOf(P.year, P.week, one) ? `${m.a} and ${m.b} didn't play in week ${P.week}`
        : mseen.has(m.key) ? 'duplicate week' : '';
      if (P) mseen.add(m.key);
      if (why) bad.push(`motw #${i} ${why}`);
    });
    // No-shows (Nov 10 2026, Evan: "Add an empty slot for Corbin's no show"): {key, who}, a manager who lost that
    // week (once the week is in the data), one entry per week.
    const ns = j.noShows == null ? [] : j.noShows;
    const nseen = new Set();
    if (!Array.isArray(ns)) bad.push('"noShows" is not a list');
    else ns.forEach((n, i) => {
      const P = n && week.parseKey(n.key);
      const one = P ? press.seedNoShows([n])[0] : null;
      const c = one ? press.context(P.year, P.week, n.who) : null;
      const why = !n || typeof n !== 'object' || Object.keys(n).some(k => !['key', 'who'].includes(k)) ? 'bad entry'
        : !one || one.key !== n.key ? 'bad key or manager'
        : P.week <= data.throughWeek(P.year) && !(c && c.lost) ? `${n.who} didn't lose in week ${P.week}`
        : nseen.has(n.key) ? 'duplicate week' : '';
      if (P) nseen.add(n.key);
      if (why) bad.push(`noShows #${i} ${why}`);
    });
    // The chat's questions: {weekKey: [{by, q, note?}]}, every entry kept as written (a manager asking, one clean
    // paragraph, an optional one-line note).
    const qs = j.questions == null ? {} : j.questions;
    let nq = 0;
    if (!qs || typeof qs !== 'object' || Array.isArray(qs)) bad.push('"questions" is not an object');
    else {
      const kept = press.seedQuestions(qs);
      Object.keys(qs).forEach(k => {
        const P = week.parseKey(k), arr = qs[k];
        if (!P || week.weekKey(P.year, P.week) !== k) { bad.push(`questions ${k}: bad week key`); return; }
        if (!Array.isArray(arr) || !arr.length) { bad.push(`questions ${k}: not a list`); return; }
        arr.forEach((x, i) => {
          const ok = x && typeof x === 'object' && Object.keys(x).every(f => ['by', 'q', 'note'].includes(f)) && kept[k] && kept[k].length === arr.length
            && kept[k][i].q === x.q && (x.note == null ? !kept[k][i].note : kept[k][i].note === x.note);
          if (!ok) bad.push(`questions ${k} #${i}: unknown field, unknown asker, not one clean paragraph (<= ${press.Q_MAX}) or a note that isn't one clean line (<= ${press.NOTE_MAX})`);
        });
        nq += arr.length;
      });
    }
    list.forEach((d, i) => {
      const p = press.normalize(d, d && d.key, 'seed');
      const why = !d || typeof d !== 'object' ? 'not an object'
        : Object.keys(d).some(k => !allowed.has(k)) ? 'unknown field'
        : !p ? 'bad key, vid / Drive id or manager'
        : d.drive != null && p.drive !== d.drive ? 'bad Drive id'
        : d.file != null && p.file !== d.file ? 'bad video file (video/press/<name>.mp4)'
        : p.key !== d.key ? 'key not canonical'
        : d.title != null && (typeof d.title !== 'string' || d.title !== p.title) ? 'title not clean (<= 80, single spaces)'
        : d.tall != null && typeof d.tall !== 'boolean' ? 'tall not a boolean'
        : seen.has(p.key) ? 'duplicate week' : '';
      if (p) seen.add(p.key);
      if (why) bad.push(`#${i} ${why}`);
    });
    return {pass: !bad.length, detail: bad.length ? bad.join('; ') : `${list.length} presser${list.length === 1 ? '' : 's'}: ${list.map(d => `${d.key} ${d.who}`).join(', ')}; ${motw.length} chat MOTW: ${motw.map(m => `${m.key} ${m.a}|${m.b}`).join(', ')}; ${nq} chat question${nq === 1 ? '' : 's'}`};
  });

  // 10. Rules
  check('Press Room: firestore.rules has the pressers block, matching what press.js writes', async () => {
    let res = null;
    try { res = await fetch(new URL('../../firestore.rules', import.meta.url).href, {cache: 'no-cache'}); } catch (_) { res = null; }
    if (!res || !res.ok) return {pass: true, detail: 'skipped: firestore.rules is not served here'};
    const text = await res.text();
    const i = text.indexOf('match /pressers/{week}');
    if (i < 0) return {pass: false, detail: 'no "match /pressers/{week}" block'};
    const block = text.slice(i, text.indexOf('\n    }', i) + 6);
    const m = /hasOnly\(\[([^\]]*)\]\)/.exec(block);
    const fields = m ? m[1].split(',').map(s => s.trim().replace(/'/g, '')) : [];
    const same = fields.slice().sort().join() === press.FIELDS.slice().sort().join();
    const shape = block.includes("matches('^[A-Za-z0-9_-]{11}$')") && block.includes(`title.size() <= ${press.TITLE_MAX}`) && block.includes('whoOk(request.resource.data)')
      && block.includes('weekOk(week)') && /allow delete: if request\.auth != null/.test(block) && /allow read: if true/.test(block);
    return {pass: same && shape, detail: `fields [${fields.join(', ')}] ${same ? 'match' : 'differ from [' + press.FIELDS.join(', ') + ']'}; vid/title/who/week checks ${shape}`};
  });

  // 11. Who was at the podium (pure parts; motwLoser itself reads the week's votes)
  check('Press Room: the Matchup of the Week loser (loserOf, seed picks); motwLoser refuses bad weeks without reading anything', async () => {
    need();
    const L = press.loserOf;
    const a = L(2026, 3, 'jaymin|ben'), b = L(2026, 3, 'ben|jaymin'), c = L(2026, 2, 'john|jackson');
    const next = data.throughWeek(2026) + 1;
    const open = next <= press.MAX_WEEK ? L(2026, next, 'evan|mitch') : null;
    const played = a && a.who === 'ben' && a.opp === 'jaymin' && a.key === '2026-w3' && a.voted && b && b.who === 'ben' && c && c.who === 'jackson' && c.opp === 'john';
    const notYet = next > press.MAX_WEEK || (open && !open.who && open.options.join() === 'evan,mitch' && open.tie === false);
    const bad = L(2026, 3, 'ben') === null && L(2026, 3, 'ben|ben') === null && L(2026, 3, 'ben|nobody') === null && L(2026, 3, null) === null;
    const sm = press.seedMotw([{key: '2026-w3', a: 'jaymin', b: 'ben'}, {key: '2026-w99', a: 'evan', b: 'ben'}, {key: '2026-w4', a: 'evan', b: 'evan'}, {key: '2026-w5', a: 'evan'}, null]);
    const seedOk = Object.keys(sm).join() === '2026-w3' && sm['2026-w3'] === 'jaymin|ben';
    const r = await Promise.all([press.motwLoser(2026, 0), press.motwLoser(2026, 18), press.motwLoser('x', 3), press.motwLoser(2026, 2.5)]);
    const refused = r.every(x => x === null);
    return {pass: played && notYet && bad && seedOk && refused, detail: `week 3: ${a && a.who} lost to ${a && a.opp}; week ${next}: ${open ? 'options ' + open.options.join('/') : 'n/a'}; malformed ${bad}; seed picks ${seedOk}; bad weeks ${JSON.stringify(r)}`};
  });

  // 12. Questions in the app, read only (Nov 18 2026, Evan: "Remove the option to add questions in the app. We are no
  // longer doing questions for the press conferences"): the ones already on the board still read, nothing writes them.
  check('Press Room: questions are read only (Evan, Nov 18 2026: “Remove the option to add questions in the app”): no way to add, send, change or delete one on any profile; the ones already on the board still read (Evan’s added set and each member’s sent set, the freshest copy, cleaned and capped)', async () => {
    const W = '2026-w4', set = (at, list) => ({at, w: {[W]: list}});
    const docs = [
      {id: 'e1', nick: 'Evan', prq: set(5, [{id: 'a', by: 'mason', q: 'Old copy'}])},
      {id: 'e2', nick: 'Evan', prq: set(9, [{id: 'b', by: 'mason', q: '  Coach,   why?  '}, {id: 'b', by: 'ben', q: 'dup'}, {id: 'c', by: 'nobody', q: 'x'}, {id: 'd', by: 'ben', q: ''}, {id: 'e', by: 'ben', q: 'Why punt?', note: 'n'.repeat(200)}])},
      {id: 'm1', nick: 'Mason', prq: set(99, [{id: 'z', by: 'mason', q: 'Not Evan’s'}])}];
    const b = press.addedOnBoard(docs), list = b ? b.w[W] : [];
    const added = !!b && b.at === 9 && list.length === 2 && list[0].q === 'Coach, why?' && list[1].note.length === press.NOTE_MAX && !press.addedOnBoard([docs[2]]);
    const sdocs = [
      {id: 'm1', nick: 'Mason', prs: set(5, [{id: 'a', q: 'Old copy', t: 1}])},
      {id: 'm2', nick: 'Mason', prs: set(9, [{id: 'b', q: '  Coach,   why?  ', t: 3}, {id: 'b', q: 'dup', t: 4}, {id: 'c', q: '', t: 5}, {id: 'd', q: 'Two', t: 6}, {id: 'e', q: 'Three', t: 7}, {id: 'f', q: 'Four', t: 8}])},
      {id: 'b1', nick: 'Ben', prs: set(2, [{id: 'z', q: 'Ben first', t: 2, by: 'mason'}])},
      {id: 'u1', nick: 'Ryan D', prs: set(99, [{id: 'u', q: 'An app user', t: 1}])}];
    const sb = press.sentOnBoard(sdocs);
    const sent = Object.keys(sb).sort().join() === 'ben,mason' && sb.mason.at === 9 && sb.mason.w[W].length === press.SQ_PER_WEEK
      && sb.mason.w[W][0].q === 'Coach, why?' && sb.mason.w[W].map(x => x.id).join() === 'b,d,e' && sb.ben.w[W][0].q === 'Ben first';
    const gone = ['saveQuestion', 'removeQuestion', 'sendQuestion', 'unsendQuestion', 'canAddQuestions', 'canSend', 'sendClosed'].filter(k => k in press);
    const views = await import('../views/press.js'), ui = ['openQuestion', 'openAsk'].filter(k => k in views);
    const seeded = press.__dev.state().seed ? press.questionsFor('2026-w2').filter(x => !x.added && !x.sent).length : 3;
    return {pass: added && sent && !gone.length && !ui.length && seeded === 3,
      detail: `added set reads ${added}; sent sets read ${sent}; write paths left: ${gone.concat(ui).join(', ') || 'none'}; week 2's seeded questions ${seeded}`};
  });
}
