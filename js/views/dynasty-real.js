// Real trading cards on Gridiron Dynasty's cards (the owner, Oct 29 2026: "i got a playing card api. add the pictures to
// gridiron rivals"): the scans his CardSight AI downloader saved (160 x 225 JPEGs), brought in by
// tools/dynasty/real_cards.py as img/dynasty/real/<player key>-<card id's first 8>.jpg. A player with them has one
// standing in his card's window (views/dynasty.js cardHTML) in place of his headshot or a Legend's number, and his card up
// close lists them all (realHTML). They load and cache as they're shown (sw.js: pictures cache-first, not precached).
// REAL: player key (data/dynasty.json players) -> his real cards, [card id's first 8, year, release, set, number], the
// one his Dynasty card shows first. A player with more than one Dynasty card (Josh Allen's Prime, Gameday and Live) has
// the next on each, in the order the series run (core/dynasty.js SERIES_ORDER).
import * as D from '../core/dynasty.js';

// <real-cards> (written by tools/dynasty/real_cards.py)
export const REAL = {
  'xtombrady': [['a9bd8cb1', 2024, 'Topps Chrome', 'Base Set', '120'], ['53a447c4', 2022, 'Donruss', 'Base Set', '255'], ['2148d15b', 2021, 'Donruss', 'Base Set', '1'], ['b9e26b87', 2020, 'Donruss', 'Base Set', '230'], ['00b8803d', 2024, 'Topps Chrome', '1974 Topps Football', '74TF-16']], // Tom Brady
  'xpeytonmanning': [['913ef800', 2024, 'Topps Chrome', 'Base Set', '86'], ['3d1c7df6', 2022, 'Donruss', 'Base Set', '57'], ['fb06998a', 2021, 'Donruss', 'Base Set', '148']], // Peyton Manning
  'xdrewbrees': [['db16130a', 2025, 'Donruss', 'Base Set', '285'], ['9371d735', 2022, 'Donruss', 'Base Set', '251'], ['bbfea499', 2021, 'Donruss', 'Base Set', '93']], // Drew Brees
  'xladainiantomli': [['fc82d7dd', 2023, 'Donruss', 'All-Time Gridiron Kings', 'ATG-6'], ['85239958', 2020, 'Donruss', 'Base Set', '142'], ['dd2f5f08', 2019, 'Donruss', 'Base Set', '137'], ['0ec41daf', 2018, 'Donruss', 'Base Set', '163']], // LaDainian Tomlinson
  'xrandymoss': [['3093deb0', 2023, 'Donruss', 'All-Time Gridiron Kings', 'ATG-10'], ['a314137f', 2024, 'Topps Chrome', 'Base Set', '112'], ['15602fe2', 2022, 'Donruss', 'Base Set', '111'], ['cb08de41', 2021, 'Donruss', 'Base Set', '128']], // Randy Moss
  'xadrianpeterson': [['063fa3a5', 2022, 'Donruss', 'Downtown', 'DT-AP'], ['05183e16', 2024, 'Topps Chrome', 'Base Set', '113'], ['ec0fbcd0', 2021, 'Donruss', 'Base Set', '175'], ['99ed8773', 2020, 'Donruss', 'Base Set', '238']], // Adrian Peterson
  'xcalvinjohnson': [['c75efa30', 2025, 'Donruss', 'Base Set', '24'], ['84fb0c87', 2019, 'Donruss', 'Base Set', '97'], ['138caa48', 2017, 'Donruss', 'Base Set', '31'], ['96716f6c', 2015, 'Donruss', 'Base Set', '83'], ['a470c16f', 2014, 'Bowman', 'Veterans', '6']], // Calvin Johnson
  '0023459': [['df5d895e', 2025, 'Donruss', 'Base Set', '97'], ['700c71a0', 2024, 'Donruss', 'Base Set', '110'], ['078f0d57', 2023, 'Donruss', 'Base Set', '227'], ['0222d3da', 2022, 'Donruss', 'Base Set', '97'], ['3037dc0b', 2021, 'Donruss', 'Base Set', '155']], // Aaron Rodgers
  '0033873': [['6e94ee7f', 2020, 'Panini Contenders', 'MVP Contenders', 'MC-PMA'], ['837b4c0f', 2019, 'Panini Prestige', 'Banner Season', 'BS-PM']], // Patrick Mahomes
  '0034857': [['7ea9a460', 2025, 'Donruss', 'Action All-Pros', 'AAP-JAL'], ['4d5fa48e', 2025, 'Donruss', 'Base Set', '91'], ['07031bab', 2024, 'Donruss', 'Base Set', '300'], ['7a302546', 2023, 'Donruss', 'Base Set', '32']], // Josh Allen
  '0034796': [['6ad26ae1', 2025, 'Donruss', 'Base Set', '102'], ['0bcc8f04', 2024, 'Donruss', 'Base Set', '130'], ['d3cc7fcf', 2023, 'Donruss', 'Base Set', '18'], ['0425e929', 2022, 'Donruss', 'Base Set', '189'], ['bceff885', 2021, 'Donruss', 'Base Set', '239']], // Lamar Jackson
  '0036442': [['a046a50b', 2025, 'Donruss', 'Base Set', '214'], ['9f3bf23c', 2024, 'Donruss', 'Base Set', '10'], ['547007ae', 2023, 'Donruss', 'Base Set', '57'], ['f5cd5d3d', 2022, 'Donruss', 'Base Set', '199'], ['0d3ecfbd', 2025, 'Donruss', 'Best of Instant', 'INS-JBW']], // Joe Burrow
  '0036322': [['ac5599c6', 2025, 'Donruss', 'Base Set', '242'], ['b39858a5', 2024, 'Donruss', 'Base Set', '215'], ['bfba7d3c', 2023, 'Donruss', 'Base Set', '196'], ['67fe6665', 2022, 'Donruss', 'Base Set', '103'], ['dda540c0', 2025, 'Donruss', 'Action All-Pros', 'AAP-JJE']], // Justin Jefferson
  '0036900': [['baa7db95', 2024, 'Donruss', 'Base Set', '95'], ['c42e18f3', 2023, 'Donruss', 'Base Set', '56'], ['ee821f08', 2022, 'Donruss', 'Base Set', '196'], ['b3c04137', 2021, 'Donruss', 'Base Set', '262'], ['2f27bb5d', 2025, 'Donruss', 'Action All-Pros', 'AAP-JCH']], // Ja'Marr Chase
  '0039163': [['4d2beeca', 2024, 'Topps Chrome', 'Base Set', '83'], ['ecefead6', 2024, 'Topps Chrome', '1974 Topps Football', '74TF-22'], ['1c52d078', 2024, 'Topps Chrome', 'Chrome All-Etch', 'CAE-CS']], // CJ Stroud
  '0039918': [['d1c305c9', 2025, 'Donruss', 'Base Set', '7'], ['b65c0cc5', 2024, 'Topps Chrome', 'Base Set', '202'], ['07bb8346', 2025, 'Donruss', 'Bomb Squad', 'BS-CWS'], ['87172cba', 2025, 'Donruss', 'Best of Instant', 'INS-CWS']], // Caleb Williams
};
// </real-cards>

/** A real card's picture (p: the player key, r: one of REAL[p]). */
export const realUrl = (p, r) => `img/dynasty/real/${p}-${r[0]}.jpg`;
/** A real card's name: "2024 Topps Chrome #120"; an insert's set named too ("2022 Donruss Downtown #DT-AP"). */
export const realName = r => `${r[1]} ${r[2]}${r[3] && r[3] !== 'Base Set' ? ' ' + r[3] : ''} #${r[4]}`;
/** A player's real cards (p: his key). */
export const realCards = p => REAL[p] || [];

// Which real card each Dynasty card shows, worked out once for each set of cards (core/dynasty.js setData)
let shown = null, of = null;
/** The real card Dynasty card c shows (one of REAL[c.p]), or null for a player without them. */
export function realOf(c) {
  if (!c || !REAL[c.p]) return null;
  if (of !== D.CARDS) {
    of = D.CARDS; shown = new Map();
    const by = new Map();
    D.CARDS.forEach(x => { if (REAL[x.p]) { if (!by.has(x.p)) by.set(x.p, []); by.get(x.p).push(x); } });
    by.forEach((list, p) => {
      list.sort((a, b) => D.SERIES_ORDER.indexOf(a.s) - D.SERIES_ORDER.indexOf(b.s) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      list.forEach((x, i) => shown.set(x.id, REAL[p][i % REAL[p].length]));
    });
  }
  return shown.get(c.id) || REAL[c.p][0];
}
