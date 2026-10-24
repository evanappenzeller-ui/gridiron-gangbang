// League pick'em and Survivor checks for the dev gallery (#/_kit): the League week (the Matchup of the Week's, its
// Thursday lock), a member's picks across phones, the lock, the grading and the table (on crafted board docs over
// a played week); Survivor's pool on crafted NFL boards (in from the first week, a loss, a tie, the week's lock at its
// first Sunday kickoff: a pick saved after it, no pick by it; a game before Sunday's locking at its own kickoff; a reused team, everyone out the same week, the winner, picks
// hidden till the lock, a pick locked in) and its refusals; the
// Pick'em tab's switch; and both reading the board as this phone may see it (THE RULE, CLAUDE.md). checks.js (owner:
// core) imports lpickChecks and calls it with its own check(name, fn) helper. Nothing here writes to storage or the
// database. Owner: PICKEM.

import * as data from './data.js';
import * as daily from './daily.js';
import * as week from './week.js';
import * as LP from './lpick.js';
import * as SV from './survivor.js';

const H = 36e5, D = 864e5;
const nickOf = id => (data.M[id] ? data.M[id].name : id);

export async function lpickChecks(check) {
  check('League pick\'em: the Matchup of the Week\'s week (the next unplayed league week, from Week 7): its six matchups, every pick locking at that week\'s first NFL kickoff', () => {
    const c = LP.current();
    if (!c) return {pass: true, detail: 'no League week right now (the schedule is played out)'};
    const ok = c.week >= (LP.FIRST[c.year] || 1) && c.games.length === 6 && c.lock.getTime() === week.lockTime(c.year, c.week).getTime()
      && c.games.every(g => g.id === LP.pairKey(g.a, g.b) && data.M[g.a] && data.M[g.b]);
    return {pass: ok, detail: `${c.year} week ${c.week}: ${c.games.map(g => `${g.a}–${g.b}`).join(', ')}; locks ${c.lock.toISOString()}`};
  });

  check('League pick\'em: a member\'s latest save before the lock counts (across their phones); a save at or after it never does; right or wrong by who won', () => {
    const y = 2026, wk = 6, key = week.weekKey(y, wk), lock = week.lockTime(y, wk).getTime();
    const games = LP.gamesOf(y, wk);
    if (games.length !== 6) return {pass: false, detail: `week 6 has ${games.length} matchups`};
    const win = g => LP.resultOf(y, wk, g.a, g.b).winner, lose = g => (win(g) === g.a ? g.b : g.a);
    const all = f => Object.fromEntries(games.map(g => [g.id, f(g)]));
    const doc = (id, nick, p, t, extra) => Object.assign({id, nick, total: 0, [LP.F]: {[key]: {p, t}}}, extra);
    const list = [
      doc('k-jy1', nickOf('jayton'), all(lose), lock - 2 * H),            // Jayton's older phone: every loser
      doc('k-jy2', nickOf('jayton'), all(win), lock - H),                 // his newer save: every winner (counts)
      doc('k-mi', nickOf('mitch'), Object.fromEntries(games.slice(0, 4).map((g, i) => [g.id, i < 3 ? win(g) : lose(g)])), lock - H),
      doc('k-jo', nickOf('john'), all(win), lock + H),                    // saved after the lock: never counts
      doc('k-gz', 'Zed Q', {[games[0].id]: win(games[0])}, lock - H, {g: true})
    ];
    const rows = LP.weekRows(y, wk, list), by = n => rows.find(r => r.name === n) || null;
    const jy = by(nickOf('jayton')), mi = by(nickOf('mitch')), gz = by('Zed Q');
    const ok = !!jy && jy.right === 6 && jy.wrong === 0 && jy.rank === 1 && !!mi && mi.right === 3 && mi.wrong === 1 && mi.picked === 4
      && !by(nickOf('john')) && !!gz && gz.guest && rows.length === 3;
    const sp = LP.splitOf(y, wk, games[0], list, lock + H);
    const split = !!sp && sp.a.length + sp.b.length === 3 && !LP.splitOf(y, wk, games[0], list, lock - H);
    return {pass: ok && split, detail: rows.map(r => `${r.rank}. ${r.name} ${r.right}–${r.wrong}${r.guest ? ' (guest)' : ''}`).join(', ') + `; split after the lock ${split ? 'shown' : 'WRONG'}, none before`};
  });

  // Survivor, on crafted NFL boards in a fixed week (Week 8 here: Thursday Oct 29 2026 8:15 PM ET, Sunday Nov 1 1 PM
  // and 4:25 PM ET), looked at Wednesday (nothing played), Saturday (Thursday's game played, the week still open) and
  // Sunday once its first game is under way (locked)
  const Z = (mo, d, h, m = 0) => Date.UTC(2026, mo, d, h, m);
  const T = abbr => ({abbr, short: abbr, name: abbr});
  const G = (id, away, home, kick, res, at) => ({id, kickoff: new Date(kick), tbd: false, away: T(away), home: T(home), detail: '', status: res && kick + 4 * H <= at ? 'STATUS_FINAL' : 'STATUS_SCHEDULED',
    state: res && kick + 4 * H <= at ? 'post' : kick <= at ? 'in' : 'pre', final: !!res && kick + 4 * H <= at, tie: res === 'tie', winner: res === 'tie' || !res || kick + 4 * H > at ? null : res});
  const wed = Z(9, 28, 16), sat = Z(9, 31, 18), sun = Z(10, 1, 19); // (Nov 1: Eastern standard time, 1 PM = 18:00 UTC)
  const thuK = Z(9, 30, 0, 15), sunK = Z(10, 1, 18), lateK = Z(10, 1, 21, 25);
  const wk7 = at => ({games: [G('71', 'KC', 'DEN', Z(9, 18, 17), 'home', at), G('72', 'BUF', 'MIA', Z(9, 18, 17), 'away', at), G('73', 'NYJ', 'NE', Z(9, 18, 17), 'tie', at)]});
  const wk8 = at => ({games: [G('81', 'KC', 'LV', thuK, 'away', at), G('82', 'DEN', 'SF', sunK, null, at), G('83', 'GB', 'CHI', lateK, null, at)]});
  const boardsAt = at => new Map([[7, wk7(at)], [8, wk8(at)]]);
  const sv = (id, nick, picks) => ({id, nick, total: 0, [SV.F]: {2026: picks}});
  const P = (k, g, t) => ({k, g, t});
  const before = Z(9, 15, 12), thuSave = Z(9, 28, 12), friSave = Z(9, 30, 12), sunSave = Z(10, 1, 18, 30);
  check('Survivor: every league member in from the first week (no pick by its lock: out), anyone else only with a pick in it; a win goes on, a loss or a tie goes out; a week\'s picks lock at its first Sunday kickoff (the owner\'s ask, Oct 24 2026): a pick saved after it doesn\'t count, no pick by it goes out; a game before Sunday\'s (Thursday night\'s) locks at its own kickoff: a pick on it saved after that doesn\'t count; a reused team doesn\'t count; others\' picks hide till the lock', () => {
    const list = [
      sv('s-jy', nickOf('jayton'), {7: P('DEN', '71', before), 8: P('KC', '81', thuSave)}),   // Thursday's game, picked before it: won
      sv('s-mi', nickOf('mitch'), {7: P('KC', '71', before)}),
      sv('s-jo', nickOf('john'), {7: P('NYJ', '73', before)}),
      sv('s-be', nickOf('ben'), {7: P('BUF', '72', before)}),                                 // no Week 8 pick
      sv('s-dr', nickOf('dresden'), {7: P('DEN', '71', Z(9, 19, 12))}),                        // after week 7's lock: no pick, out
      sv('s-sa', nickOf('sayer'), {7: P('BUF', '72', before), 8: P('DEN', '82', thuSave)}),
      sv('s-co', nickOf('corbin'), {7: P('DEN', '71', before), 8: P('DEN', '82', thuSave)}), // DEN again: no pick
      sv('s-ma', nickOf('mason'), {7: P('BUF', '72', before), 8: P('SF', '82', friSave)}),    // after Thursday's kickoff, before Sunday's: counts
      sv('s-jc', nickOf('jacob'), {7: P('BUF', '72', before), 8: P('LV', '81', friSave)}),    // Thursday's team after its kickoff: no pick
      sv('s-ev', nickOf('evan'), {7: P('BUF', '72', before), 8: P('GB', '83', sunSave)})      // after Sunday's first kickoff: no pick
    ];
    const by = (q, id) => q.rows.find(x => x.name === nickOf(id));
    const st = (q, id) => { const x = by(q, id); return x ? (x.alive ? 'in' : `out ${x.out} ${x.why}`) : 'not in'; };
    // Saturday: Thursday's game played, the week still open: nobody out for it yet (no pick, a used team or a late pick)
    const r = SV.pool(2026, 8, boardsAt(sat), list, sat);
    const want = {jayton: 'in', mitch: 'out 7 L', john: 'out 7 T', ben: 'in', dresden: 'out 7 none', sayer: 'in', corbin: 'in', mason: 'in', jacob: 'in', evan: 'in', jackson: 'out 7 none'};
    const bad = Object.keys(want).filter(id => st(r, id) !== want[id]);
    const jy = by(r, 'jayton'), hid = jy && jy.picks.find(p => p.w === 8);
    const hide = !!hid && hid.shown === false && jy.picks.find(p => p.w === 7).shown === true;
    const open = !SV.locked(wk8(sat), sat) && SV.lockOf(wk8(sat)) === sunK && SV.locked(wk8(sun), sun) && !SV.locked(wk8(wed), wed);
    // Sunday, its first game under way: locked; Ben (no pick), Corbin (a used team), Jacob (Thursday's team after its kickoff) and
    // Evan (saved after Sunday's first kickoff) go out
    const r2 = SV.pool(2026, 8, boardsAt(sun), list, sun);
    const want2 = {jayton: 'in', sayer: 'in', mason: 'in', ben: 'out 8 none', corbin: 'out 8 none', jacob: 'out 8 none', evan: 'out 8 none'};
    const bad2 = Object.keys(want2).filter(id => st(r2, id) !== want2[id]);
    const shown = (by(r2, 'jayton').picks.find(p => p.w === 8) || {}).shown === true;
    const order = r.rows.slice(0, 7).every(x => x.alive) && r.entered === SV.membersOf(2026).length && r.alive === 7 && r2.alive === 3;
    return {pass: !bad.length && hide && open && !bad2.length && shown && order, detail: `Saturday: ${Object.keys(want).map(id => `${id} ${st(r, id)}`).join(', ')}${bad.length ? `; WRONG: ${bad.join(', ')}` : ''}; week 8 picks hidden till the lock ${hide}; open till Sunday's first kickoff ${open}; Sunday: ${Object.keys(want2).map(id => `${id} ${st(r2, id)}`).join(', ')}${bad2.length ? `; WRONG: ${bad2.join(', ')}` : ''}; shown once locked ${shown}`};
  });

  check('Survivor: everyone still in who picked losing the same week all stay in (those with no pick go out); the last one standing wins', () => {
    const at = Z(9, 21, 12), boards = boardsAt(at);
    // (every other member missed week 7: out, never saved)
    const all = SV.pool(2026, 7, boards, [sv('a1', nickOf('ben'), {7: P('KC', '71', before)}), sv('a2', nickOf('mitch'), {7: P('MIA', '72', before)})], at);
    const stay = all.alive === 2 && all.rows.every(x => x.alive ? x.saved === 7 : x.why === 'none');
    const one = SV.pool(2026, 7, boards, [sv('b1', nickOf('ben'), {7: P('DEN', '71', before)}), sv('b2', nickOf('mitch'), {7: P('KC', '71', before)})], at);
    const champ = one.champion === nickOf('ben').toLowerCase() || (one.rows.find(x => x.key === one.champion) || {}).name === nickOf('ben');
    return {pass: stay && champ, detail: `both lost week 7: ${stay ? 'both still in' : 'WRONG'}; one left: ${champ ? `${nickOf('ben')} wins` : 'WRONG'}`};
  });

  check('Survivor: a pick locked in is final: a later save on another phone doesn\'t count; one locked in after the week\'s lock doesn\'t either; a pick on a game before Sunday\'s is final once it kicks off', () => {
    const L = (k, g, t) => ({k, g, t, l: 1});
    const two = [ // one member on two phones: locked in KC on one, DEN saved later on the other
      sv('l-a', nickOf('ben'), {7: P('BUF', '72', before), 8: L('KC', '81', thuSave - H)}),
      sv('l-b', nickOf('ben'), {7: P('BUF', '72', before), 8: P('DEN', '82', thuSave)}),
      sv('l-c', nickOf('mitch'), {7: P('BUF', '72', before), 8: L('SF', '82', sunSave)}) // locked in after Sunday's first kickoff
    ];
    const q = SV.pool(2026, 8, boardsAt(sun), two, sun), by = id => q.rows.find(x => x.name === nickOf(id));
    const bp = by('ben') && by('ben').picks.find(p => p.w === 8);
    const held = !!bp && bp.k === 'KC' && bp.l === true;
    const late = !!by('mitch') && by('mitch').out === 8 && by('mitch').why === 'none';
    const e = SV.entryOf({[SV.F]: {2026: {8: L('KC', '81', sat)}}}, 2026, 8), plain = SV.entryOf(two[1], 2026, 8);
    const flag = !!e && e.l === true && !!plain && plain.l === false;
    const kick = SV.kicked(wk8(sat), P('KC', '81', thuSave), sat) && !SV.kicked(wk8(wed), P('KC', '81', thuSave), wed)
      && !SV.kicked(wk8(sat), P('KC', '81', friSave), sat) && !SV.kicked(wk8(sat), P('SF', '82', friSave), sat);
    return {pass: held && late && flag && kick, detail: `two phones: ${bp ? `${bp.k}${bp.l ? ' (locked in)' : ''}` : 'none'}${held ? '' : ' WRONG'}; locked in after the lock: ${late ? 'out' : 'WRONG'}; the flag read ${flag}; Thursday's pick final once it kicks off ${kick}`};
  });

  check('Survivor: a pick is refused once the week has locked (its first Sunday kickoff, even for a game still to come), for a team whose game has kicked off (Thursday night\'s, the week still open) and for a team you\'ve used (nothing saved)', async () => {
    // (pick() reads the real clock: boards round now, on real weekdays)
    const now = Date.now(), etSun = t => new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', weekday: 'short'}).format(new Date(t)) === 'Sun';
    const sunAfter = t => { let x = new Date(t); x.setUTCHours(17, 0, 0, 0); x = x.getTime(); while (new Date(x).getUTCDay() !== 0 || x <= t) x += D; return x; };
    const sunBefore = t => { let x = sunAfter(t) - 7 * D; while (x > t) x -= 7 * D; return x; };
    const at = now, gx = (id, a, h, k) => G(id, a, h, k, null, at);
    const past = sunBefore(now - H), early = [now - D / 4, now - D, now - 2 * D].find(t => !etSun(t)), next = sunAfter(now + D), far = sunAfter(now + 4 * D);
    const shut = {games: [gx('81', 'KC', 'LV', past), gx('82', 'DEN', 'SF', now + 3 * D)]};          // Sunday's first game under way
    const thu = {games: [gx('81', 'KC', 'LV', early), gx('82', 'DEN', 'SF', next)]};                  // Thursday's under way, Sunday's to come
    const fut = {games: [gx('81', 'KC', 'LV', far - 3 * D + 6.25 * H), gx('82', 'DEN', 'SF', far)]}; // nothing played
    const r1 = await SV.pick(2026, 8, shut, 'SF', new Map());
    const r2 = await SV.pick(2026, 8, thu, 'KC', new Map());
    const used = await SV.pick(2026, 8, fut, 'KC', new Map([['KC', 7]]));
    const pre = await SV.pick(2026, (SV.FIRST[2026] || 7) - 1, fut, 'KC', new Map());
    const lock = SV.lockOf(fut) === far && SV.lockOf(thu) === next && SV.locked(shut, at) && !SV.locked(thu, at) && !SV.locked(fut, at);
    return {pass: r1 === 'locked' && r2 === 'started' && used === 'used' && pre === 'closed' && lock, detail: `after Sunday's first kickoff: ${r1}; Thursday's team after its kickoff: ${r2}; used: ${used}; before Survivor's first week: ${pre}; the lock is the first Sunday kickoff ${lock}`};
  });

  check('Pick\'em tab: NFL, NCAA, League and Survivor in the switch; League and Survivor read the board as this phone may see it (never LB.all)', async () => {
    const pk = await import('../views/pickem.js');
    const html = pk.leagueTabsHTML('lg');
    const tabs = [...html.matchAll(/data-pk-sport="(\w+)"/g)].map(m => m[1]).join();
    const lit = /data-pk-sport="lg"[^>]*aria-selected="true"/.test(html);
    const srcs = await Promise.all(['./lpick.js', './survivor.js', '../views/lpick.js', '../views/survivor.js'].map(f => fetch(new URL(f, import.meta.url)).then(r => r.text()).catch(() => '')));
    const strip = t => t.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
    const all = srcs.some(t => /LB\.all\b/.test(strip(t)));
    const raw = /LB\.raw/.test(srcs[0]) && /LB\.raw/.test(srcs[1]);
    return {pass: tabs === 'nfl,cfb,lg,sv' && lit && !all && raw && srcs.every(Boolean), detail: `tabs ${tabs}; League lit ${lit}; ${all ? 'reads LB.all' : 'no LB.all reads'}; board ${raw ? 'LB.raw' : 'NOT LB.raw'}`};
  });
  void daily;
}
