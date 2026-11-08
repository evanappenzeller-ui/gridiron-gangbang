// Home-inspired uniforms using the franchise names and palettes already shipped in
// data/dynasty.json. Separate helmet/pants colors keep the teams recognizable in play.
// [team, name, jersey, accent, helmet, pants, number]
const TEAMS = [
  ['ARI', 'Arizona Cardinals', 0x97233F, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF],
  ['ATL', 'Atlanta Falcons', 0x101820, 0xA71930, 0x101820, 0xFFFFFF, 0xFFFFFF],
  ['BAL', 'Baltimore Ravens', 0x241773, 0x9E7C0C, 0x101820, 0xFFFFFF, 0xFFFFFF],
  ['BUF', 'Buffalo Bills', 0x00338D, 0xC60C30, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF],
  ['CAR', 'Carolina Panthers', 0x101820, 0x0085CA, 0xA5ACAF, 0xA5ACAF, 0xFFFFFF],
  ['CHI', 'Chicago Bears', 0x0B162A, 0xC83803, 0x0B162A, 0xFFFFFF, 0xFFFFFF],
  ['CIN', 'Cincinnati Bengals', 0xFB4F14, 0x000000, 0xFB4F14, 0xFFFFFF, 0xFFFFFF],
  ['CLE', 'Cleveland Browns', 0x311D00, 0xFF3C00, 0xFF3C00, 0xFFFFFF, 0xFFFFFF],
  ['DAL', 'Dallas Cowboys', 0xFFFFFF, 0x003594, 0x869397, 0x869397, 0x003594],
  ['DEN', 'Denver Broncos', 0xFB4F14, 0x002244, 0x002244, 0xFFFFFF, 0xFFFFFF],
  ['DET', 'Detroit Lions', 0x0076B6, 0xB0B7BC, 0xB0B7BC, 0xB0B7BC, 0xFFFFFF],
  ['GB', 'Green Bay Packers', 0x203731, 0xFFB612, 0xFFB612, 0xFFB612, 0xFFFFFF],
  ['HOU', 'Houston Texans', 0x03202F, 0xA71930, 0x03202F, 0xFFFFFF, 0xFFFFFF],
  ['IND', 'Indianapolis Colts', 0x002C5F, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF],
  ['JAX', 'Jacksonville Jaguars', 0x006778, 0xD7A22A, 0x101820, 0x101820, 0xFFFFFF],
  ['KC', 'Kansas City Chiefs', 0xE31837, 0xFFB81C, 0xE31837, 0xFFFFFF, 0xFFFFFF],
  ['LA', 'Los Angeles Rams', 0x003594, 0xFFA300, 0x003594, 0xFFA300, 0xFFA300],
  ['LAC', 'Los Angeles Chargers', 0x0080C6, 0xFFC20E, 0xFFFFFF, 0xFFC20E, 0xFFFFFF],
  ['LV', 'Las Vegas Raiders', 0x000000, 0xA5ACAF, 0xA5ACAF, 0xA5ACAF, 0xA5ACAF],
  ['MIA', 'Miami Dolphins', 0x008E97, 0xFC4C02, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF],
  ['MIN', 'Minnesota Vikings', 0x4F2683, 0xFFC62F, 0x4F2683, 0xFFFFFF, 0xFFFFFF],
  ['NE', 'New England Patriots', 0x002244, 0xC60C30, 0xA5ACAF, 0x002244, 0xFFFFFF],
  ['NO', 'New Orleans Saints', 0x101820, 0xD3BC8D, 0xD3BC8D, 0xD3BC8D, 0xD3BC8D],
  ['NYG', 'New York Giants', 0x0B2265, 0xA71930, 0x0B2265, 0xFFFFFF, 0xFFFFFF],
  ['NYJ', 'New York Jets', 0x125740, 0xFFFFFF, 0x125740, 0xFFFFFF, 0xFFFFFF],
  ['PHI', 'Philadelphia Eagles', 0x004C54, 0xA5ACAF, 0x004C54, 0xFFFFFF, 0xFFFFFF],
  ['PIT', 'Pittsburgh Steelers', 0x101820, 0xFFB612, 0x101820, 0xFFB612, 0xFFFFFF],
  ['SEA', 'Seattle Seahawks', 0x002244, 0x69BE28, 0x002244, 0x002244, 0xB0B7BC],
  ['SF', 'San Francisco 49ers', 0xAA0000, 0xB3995D, 0xB3995D, 0xB3995D, 0xFFFFFF],
  ['TB', 'Tampa Bay Buccaneers', 0xD50A0A, 0x34302B, 0x756C60, 0x756C60, 0xFFFFFF],
  ['TEN', 'Tennessee Titans', 0x0C2340, 0x4B92DB, 0x0C2340, 0xFFFFFF, 0xFFFFFF],
  ['WAS', 'Washington Commanders', 0x5A1414, 0xFFB612, 0x5A1414, 0xFFFFFF, 0xFFB612]
];

export const TEAM_KITS = Object.freeze(TEAMS.map(([team, name, jersey, accent, helmet, pants, numFill]) => Object.freeze({
  id: 'nfl-' + team.toLowerCase(), name, team,
  colors: Object.freeze({jersey, pads: jersey, helmet, pants, belt: pants, socks: jersey,
    cleats: 0x17212D, gloves: accent, bands: accent, stripe: accent, edge: accent,
    mask: 0xC4D1D8, numFill, numEdge: jersey === 0xFFFFFF ? accent : 0x17212D,
    pattern: 'team', wordmark: name.split(' ').at(-1).toUpperCase(), team})
})));
