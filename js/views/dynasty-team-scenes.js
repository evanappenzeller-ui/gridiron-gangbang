// Each franchise gets its own local team mark, colors and electric poster composition.
// Keys follow Dynasty's card team (including Legends), not ESPN's logo aliases.
// Marks and provenance live in img/rivals/team-graphics-v2/; texture is shared and tinted in CSS.
export const TEAM_SCENES = {
  ARI: ['ARIZONA', '50% 45%', -16], ATL: ['ATLANTA', '50% 35%', 14],
  BAL: ['BALTIMORE', '60% 45%', -12], BUF: ['BUFFALO', '50% 28%', 18],
  CAR: ['CAROLINA', '55% 35%', -20], CHI: ['CHICAGO', '65% 35%', 12],
  CIN: ['CINCINNATI', '60% 48%', -18], CLE: ['CLEVELAND', '55% 30%', 16],
  DAL: ['DALLAS', '60% 35%', -14], DEN: ['DENVER', '55% 45%', 20],
  DET: ['DETROIT', '60% 35%', -12], GB: ['GREEN BAY', '60% 50%', 14],
  HOU: ['HOUSTON', '60% 35%', -18], IND: ['INDIANAPOLIS', '55% 30%', 12],
  JAX: ['JACKSONVILLE', '60% 45%', -14], KC: ['KANSAS CITY', '55% 45%', 18],
  LA: ['LOS ANGELES', '60% 45%', -12], LAC: ['LOS ANGELES', '60% 45%', 16],
  LV: ['LAS VEGAS', '60% 40%', -18], MIA: ['MIAMI', '60% 45%', 12],
  MIN: ['MINNESOTA', '55% 40%', -14], NE: ['NEW ENGLAND', '60% 40%', 18],
  NO: ['NEW ORLEANS', '55% 35%', -16], NYG: ['NEW YORK', '60% 40%', 12],
  NYJ: ['NEW YORK', '60% 30%', -18], PHI: ['PHILADELPHIA', '55% 30%', 16],
  PIT: ['PITTSBURGH', '60% 45%', -14], SEA: ['SEATTLE', '50% 20%', 18],
  SF: ['SAN FRANCISCO', '60% 45%', -18], TB: ['TAMPA BAY', '60% 45%', 14],
  TEN: ['TENNESSEE', '55% 30%', -12], WAS: ['WASHINGTON', '60% 40%', 18]
};

const TEAM_NAMES = {
  ARI: 'CARDINALS', ATL: 'FALCONS', BAL: 'RAVENS', BUF: 'BILLS', CAR: 'PANTHERS',
  CHI: 'BEARS', CIN: 'BENGALS', CLE: 'BROWNS', DAL: 'COWBOYS', DEN: 'BRONCOS',
  DET: 'LIONS', GB: 'PACKERS', HOU: 'TEXANS', IND: 'COLTS', JAX: 'JAGUARS',
  KC: 'CHIEFS', LA: 'RAMS', LAC: 'CHARGERS', LV: 'RAIDERS', MIA: 'DOLPHINS',
  MIN: 'VIKINGS', NE: 'PATRIOTS', NO: 'SAINTS', NYG: 'GIANTS', NYJ: 'JETS',
  PHI: 'EAGLES', PIT: 'STEELERS', SEA: 'SEAHAWKS', SF: '49ERS', TB: 'BUCCANEERS',
  TEN: 'TITANS', WAS: 'COMMANDERS'
};

export function teamSceneStyle(team) {
  const scene = TEAM_SCENES[team];
  if (!scene) return ''; // Unknown teams retain the edition's stadium artwork.
  const url = new URL(`../../img/rivals/team-graphics-v2/${team.toLowerCase()}.png`, import.meta.url).href;
  return `;--team-scene:url('${url}');--team-focus:${scene[1]};--team-slant:${scene[2]}deg`;
}

export function teamSceneHTML(team) {
  const scene = TEAM_SCENES[team];
  return `<span class="pk-c-scenery"${scene ? ` data-team-scene="${team}"` : ''}></span>`
    + (scene ? `<span class="pk-c-city">${TEAM_NAMES[team]}</span>` : '');
}
