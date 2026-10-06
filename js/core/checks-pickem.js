// NFL pick'em checks for the dev gallery (#/_kit): js/core/nfl.js (ESPN client) and the NFL pick'em in
// js/core/week.js, on a recorded ESPN payload, plus the Pick'em screen's drafts (js/views/pickem.js: pick, then
// submit), locking in and the week kept on this phone. checks.js (owner: CORE-DAILY) imports pickemChecks and calls it
// with its own check(name, fn) helper; every fn returns true or {pass, detail}. Nothing here fetches or touches the
// league board. Four checks write, and remove what they wrote: the draft store (a 1999 test week in localStorage),
// submitPicks (a 2099 test week on the dev stand-in only; skipped on a page that can write to the real database),
// lockPicks / unlockPicks (another 2099 test week, the same way) and the last-known week (a test key in localStorage).
// Async checks run side by side, so none of them moves the shared dev clock or identity: they pass `at` instead.
// Owner: PICKEM-CORE.

import * as data from './data.js';
import * as nfl from './nfl.js';
import * as week from './week.js';

// ---------------------------------------------------------------------------
// Recorded from https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=3&dates=2026
// on 2026-09-29 (every game final), trimmed to the fields nfl.js reads (and a few neighbours); the shape and values
// are ESPN's. W4 is three games of week 4 from the same day (before kickoff: ESPN sends score '0' and no winner).

const W3 = {"leagues":[{"season":{"year":2026,"displayName":"2026","type":{"id":"2","type":2,"name":"Regular Season","abbreviation":"reg"}},"calendar":[{"label":"Regular Season","value":"2","entries":[
  {"label":"Week 1","value":"1","startDate":"2026-09-06T07:00Z","endDate":"2026-09-16T06:59Z"},{"label":"Week 2","value":"2","startDate":"2026-09-16T07:00Z","endDate":"2026-09-23T06:59Z"},
  {"label":"Week 3","value":"3","startDate":"2026-09-23T07:00Z","endDate":"2026-09-30T06:59Z"},{"label":"Week 4","value":"4","startDate":"2026-09-30T07:00Z","endDate":"2026-10-07T06:59Z"},
  {"label":"Week 5","value":"5","startDate":"2026-10-07T07:00Z","endDate":"2026-10-14T06:59Z"},{"label":"Week 6","value":"6","startDate":"2026-10-14T07:00Z","endDate":"2026-10-21T06:59Z"},
  {"label":"Week 7","value":"7","startDate":"2026-10-21T07:00Z","endDate":"2026-10-28T06:59Z"},{"label":"Week 8","value":"8","startDate":"2026-10-28T07:00Z","endDate":"2026-11-04T07:59Z"},
  {"label":"Week 9","value":"9","startDate":"2026-11-04T08:00Z","endDate":"2026-11-11T07:59Z"},{"label":"Week 10","value":"10","startDate":"2026-11-11T08:00Z","endDate":"2026-11-18T07:59Z"},
  {"label":"Week 11","value":"11","startDate":"2026-11-18T08:00Z","endDate":"2026-11-25T07:59Z"},{"label":"Week 12","value":"12","startDate":"2026-11-25T08:00Z","endDate":"2026-12-02T07:59Z"},
  {"label":"Week 13","value":"13","startDate":"2026-12-02T08:00Z","endDate":"2026-12-09T07:59Z"},{"label":"Week 14","value":"14","startDate":"2026-12-09T08:00Z","endDate":"2026-12-16T07:59Z"},
  {"label":"Week 15","value":"15","startDate":"2026-12-16T08:00Z","endDate":"2026-12-23T07:59Z"},{"label":"Week 16","value":"16","startDate":"2026-12-23T08:00Z","endDate":"2026-12-30T07:59Z"},
  {"label":"Week 17","value":"17","startDate":"2026-12-30T08:00Z","endDate":"2027-01-06T07:59Z"},{"label":"Week 18","value":"18","startDate":"2027-01-06T08:00Z","endDate":"2027-01-13T07:59Z"}]}]}],
  "season":{"type":2,"year":2026},"week":{"number":3},"events":[
  {"id":"401872948","date":"2026-09-25T00:15Z","name":"Atlanta Falcons at Green Bay Packers","shortName":"ATL @ GB","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Lambeau Field","address":{"city":"Green Bay","state":"WI","country":"USA"}},"notes":[],"broadcasts":[{"names":["Prime Video"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"9","homeAway":"home","winner":false,"score":"14","team":{"id":"9","abbreviation":"GB","displayName":"Green Bay Packers","shortDisplayName":"Packers","color":"204e32","alternateColor":"ffb612","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/gb.png"},"records":[{"type":"total","summary":"1-2"}]},{"id":"1","homeAway":"away","winner":true,"score":"35","team":{"id":"1","abbreviation":"ATL","displayName":"Atlanta Falcons","shortDisplayName":"Falcons","color":"a71930","alternateColor":"000000","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/atl.png"},"records":[{"type":"total","summary":"1-2"}]}]}]},
  {"id":"401872953","date":"2026-09-27T17:00Z","name":"Los Angeles Chargers at Buffalo Bills","shortName":"LAC @ BUF","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Highmark Stadium","address":{"city":"Orchard Park","state":"NY","country":"USA"}},"notes":[],"broadcasts":[{"names":["FOX"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"2","homeAway":"home","winner":true,"score":"24","team":{"id":"2","abbreviation":"BUF","displayName":"Buffalo Bills","shortDisplayName":"Bills","color":"00338d","alternateColor":"d50a0a","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/buf.png"},"records":[{"type":"total","summary":"3-0"}]},{"id":"24","homeAway":"away","winner":false,"score":"16","team":{"id":"24","abbreviation":"LAC","displayName":"Los Angeles Chargers","shortDisplayName":"Chargers","color":"0080c6","alternateColor":"ffc20e","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/lac.png"},"records":[{"type":"total","summary":"0-3"}]}]}]},
  {"id":"401872949","date":"2026-09-27T17:00Z","name":"Carolina Panthers at Cleveland Browns","shortName":"CAR @ CLE","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Huntington Bank Field","address":{"city":"Cleveland","state":"OH","country":"USA"}},"notes":[],"broadcasts":[{"names":["FOX"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"5","homeAway":"home","winner":true,"score":"21","team":{"id":"5","abbreviation":"CLE","displayName":"Cleveland Browns","shortDisplayName":"Browns","color":"472a08","alternateColor":"ff3c00","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/cle.png"},"records":[{"type":"total","summary":"2-1"}]},{"id":"29","homeAway":"away","winner":false,"score":"18","team":{"id":"29","abbreviation":"CAR","displayName":"Carolina Panthers","shortDisplayName":"Panthers","color":"0085ca","alternateColor":"000000","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/car.png"},"records":[{"type":"total","summary":"1-2"}]}]}]},
  {"id":"401872954","date":"2026-09-27T17:00Z","name":"New York Jets at Detroit Lions","shortName":"NYJ @ DET","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Ford Field","address":{"city":"Detroit","state":"MI","country":"USA"}},"notes":[],"broadcasts":[{"names":["FOX"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"8","homeAway":"home","winner":true,"score":"31","team":{"id":"8","abbreviation":"DET","displayName":"Detroit Lions","shortDisplayName":"Lions","color":"0076b6","alternateColor":"bbbbbb","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/det.png"},"records":[{"type":"total","summary":"2-1"}]},{"id":"20","homeAway":"away","winner":false,"score":"24","team":{"id":"20","abbreviation":"NYJ","displayName":"New York Jets","shortDisplayName":"Jets","color":"115740","alternateColor":"ffffff","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nyj.png"},"records":[{"type":"total","summary":"1-2"}]}]}]},
  {"id":"401872951","date":"2026-09-27T17:00Z","name":"Houston Texans at Indianapolis Colts","shortName":"HOU @ IND","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Lucas Oil Stadium","address":{"city":"Indianapolis","state":"IN","country":"USA"}},"notes":[],"broadcasts":[{"names":["CBS"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"11","homeAway":"home","winner":true,"score":"19","team":{"id":"11","abbreviation":"IND","displayName":"Indianapolis Colts","shortDisplayName":"Colts","color":"003b75","alternateColor":"ffffff","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ind.png"},"records":[{"type":"total","summary":"1-2"}]},{"id":"34","homeAway":"away","winner":false,"score":"17","team":{"id":"34","abbreviation":"HOU","displayName":"Houston Texans","shortDisplayName":"Texans","color":"021018","alternateColor":"eb0028","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/hou.png"},"records":[{"type":"total","summary":"0-3"}]}]}]},
  {"id":"401872952","date":"2026-09-27T17:00Z","name":"Kansas City Chiefs at Miami Dolphins","shortName":"KC @ MIA","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Hard Rock Stadium","address":{"city":"Miami Gardens","state":"FL","country":"USA"}},"notes":[],"broadcasts":[{"names":["CBS"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"15","homeAway":"home","winner":false,"score":"10","team":{"id":"15","abbreviation":"MIA","displayName":"Miami Dolphins","shortDisplayName":"Dolphins","color":"008e97","alternateColor":"fc4c02","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/mia.png"},"records":[{"type":"total","summary":"0-3"}]},{"id":"12","homeAway":"away","winner":true,"score":"24","team":{"id":"12","abbreviation":"KC","displayName":"Kansas City Chiefs","shortDisplayName":"Chiefs","color":"e31837","alternateColor":"ffb612","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/kc.png"},"records":[{"type":"total","summary":"3-0"}]}]}]},
  {"id":"401872956","date":"2026-09-27T17:00Z","name":"Tennessee Titans at New York Giants","shortName":"TEN @ NYG","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"MetLife Stadium","address":{"city":"East Rutherford","state":"NJ","country":"USA"}},"notes":[],"broadcasts":[{"names":["CBS"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"19","homeAway":"home","winner":true,"score":"12","team":{"id":"19","abbreviation":"NYG","displayName":"New York Giants","shortDisplayName":"Giants","color":"003c7f","alternateColor":"c9243f","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nyg.png"},"records":[{"type":"total","summary":"2-1"}]},{"id":"10","homeAway":"away","winner":false,"score":"7","team":{"id":"10","abbreviation":"TEN","displayName":"Tennessee Titans","shortDisplayName":"Titans","color":"4495d2","alternateColor":"001532","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ten.png"},"records":[{"type":"total","summary":"0-3"}]}]}]},
  {"id":"401872950","date":"2026-09-27T17:00Z","name":"Cincinnati Bengals at Pittsburgh Steelers","shortName":"CIN @ PIT","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Acrisure Stadium","address":{"city":"Pittsburgh","state":"PA","country":"USA"}},"notes":[],"broadcasts":[{"names":["CBS"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"23","homeAway":"home","winner":true,"score":"30","team":{"id":"23","abbreviation":"PIT","displayName":"Pittsburgh Steelers","shortDisplayName":"Steelers","color":"000000","alternateColor":"ffb612","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/pit.png"},"records":[{"type":"total","summary":"2-1"}]},{"id":"4","homeAway":"away","winner":false,"score":"27","team":{"id":"4","abbreviation":"CIN","displayName":"Cincinnati Bengals","shortDisplayName":"Bengals","color":"fb4f14","alternateColor":"000000","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/cin.png"},"records":[{"type":"total","summary":"2-1"}]}]}]},
  {"id":"401872955","date":"2026-09-27T17:00Z","name":"Seattle Seahawks at Washington Commanders","shortName":"SEA @ WSH","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Northwest Stadium","address":{"city":"Landover","state":"MD","country":"USA"}},"notes":[],"broadcasts":[{"names":["FOX"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"28","homeAway":"home","winner":true,"score":"33","team":{"id":"28","abbreviation":"WSH","displayName":"Washington Commanders","shortDisplayName":"Commanders","color":"5a1414","alternateColor":"ffb612","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/wsh.png"},"records":[{"type":"total","summary":"1-2"}]},{"id":"26","homeAway":"away","winner":false,"score":"31","team":{"id":"26","abbreviation":"SEA","displayName":"Seattle Seahawks","shortDisplayName":"Seahawks","color":"002a5c","alternateColor":"69be28","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/sea.png"},"records":[{"type":"total","summary":"2-1"}]}]}]},
  {"id":"401872957","date":"2026-09-27T17:00Z","name":"New England Patriots at Jacksonville Jaguars","shortName":"NE @ JAX","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"EverBank Stadium","address":{"city":"Jacksonville","state":"FL","country":"USA"}},"notes":[],"broadcasts":[{"names":["CBS"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"30","homeAway":"home","winner":true,"score":"35","team":{"id":"30","abbreviation":"JAX","displayName":"Jacksonville Jaguars","shortDisplayName":"Jaguars","color":"007487","alternateColor":"d7a22a","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/jax.png"},"records":[{"type":"total","summary":"2-1"}]},{"id":"17","homeAway":"away","winner":false,"score":"6","team":{"id":"17","abbreviation":"NE","displayName":"New England Patriots","shortDisplayName":"Patriots","color":"002a5c","alternateColor":"c60c30","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ne.png"},"records":[{"type":"total","summary":"1-2"}]}]}]},
  {"id":"401872958","date":"2026-09-27T20:05Z","name":"Arizona Cardinals at San Francisco 49ers","shortName":"ARI @ SF","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Levi's Stadium","address":{"city":"Santa Clara","state":"CA","country":"USA"}},"notes":[],"broadcasts":[{"names":["FOX"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"25","homeAway":"home","winner":true,"score":"36","team":{"id":"25","abbreviation":"SF","displayName":"San Francisco 49ers","shortDisplayName":"49ers","color":"aa0000","alternateColor":"b3995d","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/sf.png"},"records":[{"type":"total","summary":"3-0"}]},{"id":"22","homeAway":"away","winner":false,"score":"30","team":{"id":"22","abbreviation":"ARI","displayName":"Arizona Cardinals","shortDisplayName":"Cardinals","color":"a40227","alternateColor":"ffffff","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ari.png"},"records":[{"type":"total","summary":"1-2"}]}]}]},
  {"id":"401872959","date":"2026-09-27T20:05Z","name":"Minnesota Vikings at Tampa Bay Buccaneers","shortName":"MIN @ TB","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Raymond James Stadium","address":{"city":"Tampa","state":"FL","country":"USA"}},"notes":[],"broadcasts":[{"names":["FOX"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"27","homeAway":"home","winner":false,"score":"16","team":{"id":"27","abbreviation":"TB","displayName":"Tampa Bay Buccaneers","shortDisplayName":"Buccaneers","color":"bd1c36","alternateColor":"3e3a35","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/tb.png"},"records":[{"type":"total","summary":"0-3"}]},{"id":"16","homeAway":"away","winner":true,"score":"23","team":{"id":"16","abbreviation":"MIN","displayName":"Minnesota Vikings","shortDisplayName":"Vikings","color":"4f2683","alternateColor":"ffc62f","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/min.png"},"records":[{"type":"total","summary":"3-0"}]}]}]},
  {"id":"401872960","date":"2026-09-27T20:25Z","name":"Baltimore Ravens at Dallas Cowboys","shortName":"BAL VS DAL","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":true,"venue":{"fullName":"Maracanã Stadium","address":{"city":"Rio De Janeiro","country":"Brazil"}},"notes":[{"headline":"NFL Rio Game"}],"broadcasts":[{"names":["CBS"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"6","homeAway":"home","winner":false,"score":"31","team":{"id":"6","abbreviation":"DAL","displayName":"Dallas Cowboys","shortDisplayName":"Cowboys","color":"002a5c","alternateColor":"b0b7bc","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/dal.png"},"records":[{"type":"total","summary":"1-2"}]},{"id":"33","homeAway":"away","winner":true,"score":"34","team":{"id":"33","abbreviation":"BAL","displayName":"Baltimore Ravens","shortDisplayName":"Ravens","color":"29126f","alternateColor":"000000","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/bal.png"},"records":[{"type":"total","summary":"2-1"}]}]}]},
  {"id":"401872961","date":"2026-09-27T20:25Z","name":"Las Vegas Raiders at New Orleans Saints","shortName":"LV @ NO","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Caesars Superdome","address":{"city":"New Orleans","state":"LA","country":"USA"}},"notes":[],"broadcasts":[{"names":["CBS"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"18","homeAway":"home","winner":false,"score":"27","team":{"id":"18","abbreviation":"NO","displayName":"New Orleans Saints","shortDisplayName":"Saints","color":"d3bc8d","alternateColor":"000000","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/no.png"},"records":[{"type":"total","summary":"1-2"}]},{"id":"13","homeAway":"away","winner":true,"score":"35","team":{"id":"13","abbreviation":"LV","displayName":"Las Vegas Raiders","shortDisplayName":"Raiders","color":"000000","alternateColor":"a5acaf","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/lv.png"},"records":[{"type":"total","summary":"3-0"}]}]}]},
  {"id":"401872962","date":"2026-09-28T00:20Z","name":"Los Angeles Rams at Denver Broncos","shortName":"LAR @ DEN","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Empower Field at Mile High","address":{"city":"Denver","state":"CO","country":"USA"}},"notes":[],"broadcasts":[{"names":["NBC"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"7","homeAway":"home","winner":true,"score":"30","team":{"id":"7","abbreviation":"DEN","displayName":"Denver Broncos","shortDisplayName":"Broncos","color":"0a2343","alternateColor":"fc4c02","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/den.png"},"records":[{"type":"total","summary":"2-1"}]},{"id":"14","homeAway":"away","winner":false,"score":"26","team":{"id":"14","abbreviation":"LAR","displayName":"Los Angeles Rams","shortDisplayName":"Rams","color":"003594","alternateColor":"ffd100","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/lar.png"},"records":[{"type":"total","summary":"1-2"}]}]}]},
  {"id":"401872963","date":"2026-09-29T00:15Z","name":"Philadelphia Eagles at Chicago Bears","shortName":"PHI @ CHI","season":{"year":2026,"type":2},"week":{"number":3},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Soldier Field","address":{"city":"Chicago","state":"IL","country":"USA"}},"notes":[],"broadcasts":[{"names":["ESPN","ABC"]}],"status":{"clock":0,"displayClock":"0:00","period":4,"type":{"id":"3","name":"STATUS_FINAL","state":"post","completed":true,"description":"Final","detail":"Final","shortDetail":"Final"}},"competitors":[{"id":"3","homeAway":"home","winner":true,"score":"27","team":{"id":"3","abbreviation":"CHI","displayName":"Chicago Bears","shortDisplayName":"Bears","color":"0b1c3a","alternateColor":"e64100","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/chi.png"},"records":[{"type":"total","summary":"2-1"}]},{"id":"21","homeAway":"away","winner":false,"score":"7","team":{"id":"21","abbreviation":"PHI","displayName":"Philadelphia Eagles","shortDisplayName":"Eagles","color":"06424d","alternateColor":"000000","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/phi.png"},"records":[{"type":"total","summary":"2-1"}]}]}]}
]};

const W4 = {"season":{"type":2,"year":2026},"week":{"number":4},"events":[
  {"id":"401872964","date":"2026-10-02T00:15Z","name":"Pittsburgh Steelers at Cleveland Browns","shortName":"PIT @ CLE","season":{"year":2026,"type":2},"week":{"number":4},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Huntington Bank Field","address":{"city":"Cleveland","state":"OH","country":"USA"}},"notes":[],"broadcasts":[{"names":["Prime Video"]}],"status":{"clock":0,"displayClock":"0:00","period":0,"type":{"id":"1","name":"STATUS_SCHEDULED","state":"pre","completed":false,"description":"Scheduled","detail":"Thu, October 1st at 8:15 PM EDT","shortDetail":"10/1 - 8:15 PM EDT"}},"competitors":[{"id":"5","homeAway":"home","score":"0","team":{"id":"5","abbreviation":"CLE","displayName":"Cleveland Browns","shortDisplayName":"Browns","color":"472a08","alternateColor":"ff3c00","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/cle.png"},"records":[{"type":"total","summary":"2-1"}]},{"id":"23","homeAway":"away","score":"0","team":{"id":"23","abbreviation":"PIT","displayName":"Pittsburgh Steelers","shortDisplayName":"Steelers","color":"000000","alternateColor":"ffb612","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/pit.png"},"records":[{"type":"total","summary":"2-1"}]}]}]},
  {"id":"401872965","date":"2026-10-04T13:30Z","name":"Indianapolis Colts at Washington Commanders","shortName":"IND VS WSH","season":{"year":2026,"type":2},"week":{"number":4},"competitions":[{"timeValid":true,"neutralSite":true,"venue":{"fullName":"Tottenham Hotspur Stadium","address":{"city":"London","country":"England"}},"notes":[{"headline":"NFL London Games"}],"broadcasts":[{"names":["NFL Net"]}],"status":{"clock":0,"displayClock":"0:00","period":0,"type":{"id":"1","name":"STATUS_SCHEDULED","state":"pre","completed":false,"description":"Scheduled","detail":"Sun, October 4th at 9:30 AM EDT","shortDetail":"10/4 - 9:30 AM EDT"}},"competitors":[{"id":"28","homeAway":"home","score":"0","team":{"id":"28","abbreviation":"WSH","displayName":"Washington Commanders","shortDisplayName":"Commanders","color":"5a1414","alternateColor":"ffb612","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/wsh.png"},"records":[{"type":"total","summary":"1-2"}]},{"id":"11","homeAway":"away","score":"0","team":{"id":"11","abbreviation":"IND","displayName":"Indianapolis Colts","shortDisplayName":"Colts","color":"003b75","alternateColor":"ffffff","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ind.png"},"records":[{"type":"total","summary":"1-2"}]}]}]},
  {"id":"401872979","date":"2026-10-06T00:15Z","name":"Atlanta Falcons at New Orleans Saints","shortName":"ATL @ NO","season":{"year":2026,"type":2},"week":{"number":4},"competitions":[{"timeValid":true,"neutralSite":false,"venue":{"fullName":"Caesars Superdome","address":{"city":"New Orleans","state":"LA","country":"USA"}},"notes":[],"broadcasts":[{"names":["ESPN"]}],"status":{"clock":0,"displayClock":"0:00","period":0,"type":{"id":"1","name":"STATUS_SCHEDULED","state":"pre","completed":false,"description":"Scheduled","detail":"Mon, October 5th at 8:15 PM EDT","shortDetail":"10/5 - 8:15 PM EDT"}},"competitors":[{"id":"18","homeAway":"home","score":"0","team":{"id":"18","abbreviation":"NO","displayName":"New Orleans Saints","shortDisplayName":"Saints","color":"d3bc8d","alternateColor":"000000","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/no.png"},"records":[{"type":"total","summary":"1-2"}]},{"id":"1","homeAway":"away","score":"0","team":{"id":"1","abbreviation":"ATL","displayName":"Atlanta Falcons","shortDisplayName":"Falcons","color":"a71930","alternateColor":"000000","logo":"https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/atl.png"},"records":[{"type":"total","summary":"1-2"}]}]}]}
]};

// ---------------------------------------------------------------------------
// Helpers

const clone = o => JSON.parse(JSON.stringify(o));
const ms = s => Date.parse(s);
const MIN = 60e3, HOUR = 3600e3, DAY = 864e5;
// Every week-3 winner in kickoff order (hand-copied from the final scores above).
const W3_WINNERS = 'ATL BUF CLE DET IND KC NYG PIT WSH JAX SF MIN BAL LV DEN CHI';

// Set one recorded event's status and score (the shapes ESPN uses for those states).
const STATUS = {
  pre: {id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled', detail: 'Sun, October 4th at 9:30 AM EDT', shortDetail: '10/4 - 9:30 AM EDT'},
  in: {id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: '4:12 - 3rd Quarter', shortDetail: '4:12 - 3rd'},
  half: {id: '23', name: 'STATUS_HALFTIME', state: 'in', completed: false, description: 'Halftime', detail: 'Halftime', shortDetail: 'Halftime'},
  post: {id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final'},
  ot: {id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final/OT', shortDetail: 'Final/OT'},
  postponed: {id: '6', name: 'STATUS_POSTPONED', state: 'post', completed: false, description: 'Postponed', detail: 'Postponed', shortDetail: 'Postponed'},
  canceled: {id: '5', name: 'STATUS_CANCELED', state: 'post', completed: false, description: 'Canceled', detail: 'Canceled', shortDetail: 'Canceled'}
};
function setGame(payload, id, kind, home, away) {
  const e = payload.events.find(x => x.id === id);
  const c = e.competitions[0];
  c.status = {clock: kind === 'in' ? 252 : 0, displayClock: kind === 'in' ? '4:12' : '0:00', period: kind === 'in' ? 3 : kind === 'half' ? 2 : 4, type: clone(STATUS[kind])};
  const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
  H.score = String(home); A.score = String(away);
  const done = kind === 'post' || kind === 'ot';
  if (done) { H.winner = home > away; A.winner = away > home; } else { delete H.winner; delete A.winner; }
  return payload;
}

const needData = () => { if (!data.DATA || !data.M) throw new Error('league did not load'); };
// Remove a test week from the dev stand-in, and whatever it created to hold it: the stand-in is left as it was.
function dropTestWeek(key) {
  try {
    const o = JSON.parse(localStorage.getItem('gg-dev-week') || 'null');
    if (!o) return;
    ['nflpicks', 'nfllocks'].forEach(k => { if (o[k]) { delete o[k][key]; if (!Object.keys(o[k]).length) delete o[k]; } });
    if (Object.keys(o).length) localStorage.setItem('gg-dev-week', JSON.stringify(o)); else localStorage.removeItem('gg-dev-week');
  } catch (_) {}
}
const mgr = id => { if (!data.M[id]) throw new Error('no manager ' + id); return id; };

// ---------------------------------------------------------------------------

export async function pickemChecks(check) {
  let err = null;
  try { await data.load(); } catch (e) { err = e; }
  const need = () => { if (err) throw new Error('league did not load: ' + (err.message || err)); needData(); };

  // 1. The recorded week-3 payload
  check('NFL scoreboard: recorded 2026 week 3 parses (16 final games, winners, scores, records, the Rio game)', () => {
    const b = nfl.parse(clone(W3));
    const g = b.games;
    const winners = g.map(x => x[x.winner].abbr).join(' ');
    const first = g[0], rio = g.find(x => x.id === '401872960'), mnf = g[g.length - 1];
    const shape = b.year === 2026 && b.week === 3 && b.seasontype === 2 && b.weeks === 18 && b.cal.length === 18
      && b.cal[3].week === 4 && b.cal[3].start === ms('2026-09-30T07:00Z')
      && g.length === 16 && g.every(x => x.state === 'post' && x.final && !x.tie && x.detail === 'Final' && x.home.score != null && x.away.score != null)
      && g.every((x, i) => !i || x.kickoff >= g[i - 1].kickoff) && new Set(g.map(x => x.id)).size === 16;
    const one = first.id === '401872948' && first.kickoff.toISOString() === '2026-09-25T00:15:00.000Z' && first.label === 'ATL @ GB'
      && first.away.abbr === 'ATL' && first.away.score === 35 && first.home.score === 14 && first.winner === 'away' && first.away.winner && !first.home.winner
      && first.home.name === 'Green Bay Packers' && first.home.short === 'Packers' && first.home.record === '1–2' && first.home.color === '#204e32'
      && /^https:\/\/a\.espncdn\.com\//.test(first.home.logo) && first.tv === 'Prime Video' && first.intl === '' && !first.neutral;
    const intl = rio && rio.intl === 'Brazil' && rio.neutral && rio.note === 'NFL Rio Game' && rio.winner === 'away' && rio.away.abbr === 'BAL';
    const pass = shape && one && intl && winners === W3_WINNERS && mnf.tv === 'ESPN / ABC' && mnf.home.abbr === 'CHI';
    return {pass, detail: `${g.length} games, winners ${winners === W3_WINNERS ? 'match' : 'differ: ' + winners}; ${first.label} ${first.away.score}–${first.home.score}; ${rio && rio.label} in ${rio && rio.intl}`};
  });

  // 2. Before kickoff, live, halftime, overtime, postponed, malformed
  check('NFL scoreboard: states before kickoff, live, halftime, OT, postponed; malformed events dropped', () => {
    const b = nfl.parse(clone(W4));
    const [thu, lon, mon] = b.games;
    const pre = b.week === 4 && b.games.length === 3 && b.games.every(x => x.state === 'pre' && !x.final && x.winner === null && x.home.score === null && x.away.score === null && !x.home.winner)
      && thu.detail === '10/1 - 8:15 PM EDT' && thu.kickoff.toISOString() === '2026-10-02T00:15:00.000Z' && thu.home.record === '2–1'
      && lon.intl === 'England' && lon.note === 'NFL London Games' && lon.home.abbr === 'WSH' && lon.away.abbr === 'IND' && mon.label === 'ATL @ NO';
    const p = clone(W4);
    setGame(p, '401872964', 'in', 17, 10); setGame(p, '401872965', 'half', 3, 7); setGame(p, '401872979', 'ot', 23, 26);
    const [a, h, o] = nfl.parse(p).games;
    const states = a.state === 'in' && a.detail === '4:12 - 3rd' && a.clock === '4:12' && a.period === 3 && a.home.score === 17 && a.winner === null && !a.final
      && h.state === 'in' && h.detail === 'Halftime' && o.final && o.detail === 'Final/OT' && o.winner === 'away' && o.away.winner;
    const q = setGame(clone(W4), '401872965', 'postponed', 0, 0);
    const pp = nfl.parse(q).games[1];
    const off = pp.state === 'post' && !pp.final && pp.winner === null && !pp.tie;
    const bad = clone(W4);
    bad.events.push({id: 'x1', date: '2026-10-04T17:00Z', competitions: [bad.events[0].competitions[0]]});             // bad id
    bad.events.push({id: '401872999', date: '2026-10-04T17:00Z', competitions: [{competitors: []}]});                   // no teams
    bad.events.push(Object.assign(clone(bad.events[0]), {id: '401872998', date: 'soon'}));                              // bad date
    bad.events.push(clone(bad.events[0]));                                                                              // duplicate
    const drop = nfl.parse(bad).games.length === 3;
    let threw = false;
    try { nfl.parse({events: 'nope'}); } catch (_) { threw = true; }
    return {pass: pre && states && off && drop && threw, detail: `pre ${pre}, live/half/OT ${states}, postponed ${off}, malformed dropped ${drop}, non-scoreboard throws ${threw}`};
  });

  // 3. Which week the pick'em is on
  check('Pick\'em week: ESPN\'s week, or the next one once every game in it is over (a postponed game holds it)', () => {
    const b3 = nfl.parse(clone(W3));
    const w = nfl.pickWeek(b3);
    const live = nfl.pickWeek(nfl.parse(setGame(clone(W3), '401872963', 'in', 7, 3)));
    const w4 = nfl.pickWeek(nfl.parse(clone(W4)));
    const pre = nfl.pickWeek(Object.assign({}, b3, {seasontype: 1, week: 3}));
    const post = nfl.pickWeek(Object.assign({}, b3, {seasontype: 3, week: 1}));
    const last = nfl.pickWeek(Object.assign({}, b3, {week: 18}));
    const empty = nfl.pickWeek(Object.assign({}, b3, {games: []}));
    // Postponed (state 'post', not completed) can come back: the week is not over, not cached for good, still polled.
    // Canceled is over for good.
    const pp = nfl.parse(setGame(clone(W3), '401872963', 'postponed', 0, 0)), held = nfl.pickWeek(pp);
    const cx = nfl.parse(setGame(clone(W3), '401872963', 'canceled', 0, 0)), moved = nfl.pickWeek(cx);
    const over = nfl.weekOver(b3.games) && !nfl.weekOver(pp.games) && nfl.weekOver(cx.games) && !nfl.weekOver([]) && !nfl.gameOver(pp.games[15]);
    const pass = w.week === 4 && w.espnWeek === 3 && w.advanced && w.year === 2026 && live.week === 3 && !live.advanced && w4.week === 4
      && pre.week === 1 && post.week === 18 && last.week === 18 && empty.week === 3 && held.week === 3 && !held.advanced && moved.week === 4 && over;
    return {pass, detail: `all final: week ${w.week}; MNF live: ${live.week}; MNF postponed: ${held.week}; MNF canceled: ${moved.week}; week 4 before kickoff: ${w4.week}; preseason ${pre.week}, postseason ${post.week}, week 18 over ${last.week}`};
  });

  check('College pick\'em week: a finished Saturday stays up through Monday; the next week opens at the Tuesday reset (3:00 AM ET)', () => {
    const day = 864e5, start = Date.parse('2026-09-29T07:00Z'); // ESPN's college week 6: Tuesday to Monday
    const cal = [6, 7].map((wk, i) => ({week: wk, start: start + i * 7 * day, end: start + (i + 1) * 7 * day - 1}));
    const fin = [{state: 'post', final: true, kickoff: new Date('2026-10-03T23:30Z'), home: {}, away: {}}];
    const b6 = {year: 2026, week: 6, seasontype: 2, weeks: 16, games: fin, cal};
    const b7 = {year: 2026, week: 7, seasontype: 2, weeks: 16, games: [{state: 'pre', kickoff: new Date('2026-10-10T16:00Z'), home: {}, away: {}}], cal};
    const at = t => ({cfb: true, at: Date.parse(t)});
    const rows = [['2026-10-04T16:00Z', 6, 6], ['2026-10-05T23:00Z', 6, 6], ['2026-10-06T06:59Z', 6, 6], ['2026-10-06T07:00Z', 7, 7], ['2026-10-07T12:00Z', 7, 7]];
    const bad = rows.filter(([t, a, b]) => nfl.pickWeek(b6, 16, at(t)).week !== a || nfl.pickWeek(b7, 16, at(t)).week !== b).map(r => r[0]);
    if (nfl.pickWeek(b6).week !== 7) bad.push('the NFL rule changed');
    return {pass: !bad.length, detail: bad.length ? 'wrong week at ' + bad.join(', ') : 'Week 6 stays up Sunday and Monday (however ESPN moves), Week 7 from Tuesday 3:00 AM ET; the NFL still moves on when its week is over'};
  });

  // 4. Locks
  check('Lock per game: at its own kickoff (or once ESPN shows it started), not the week\'s', () => {
    const [thu, lon] = nfl.parse(clone(W4)).games;
    const k = thu.kickoff.getTime();
    const early = nfl.parse(setGame(clone(W4), '401872965', 'in', 0, 0)).games[1]; // started before its listed time
    const pass = !week.gameLocked(thu, k - 1) && week.gameLocked(thu, k) && week.gameLocked(thu, k + HOUR)
      && !week.gameLocked(lon, k + HOUR) && week.gameLocked(lon, lon.kickoff.getTime()) && week.gameLocked(early, k)
      && week.gameLocked(thu, new Date(k)) && !nfl.gameStarted(thu, k - 1) && nfl.gameStarted(thu, k);
    return {pass, detail: `Thu locks ${thu.kickoff.toISOString()}; London still open then; London locks ${lon.kickoff.toISOString()}`};
  });

  // 5. Late picks
  check('Late picks never count: stamped at or after that game\'s kickoff, unstamped, for another team, or saved against a later kickoff', () => {
    need();
    const p = clone(W4);
    setGame(p, '401872964', 'post', 20, 17); // Thursday is over (its picks are revealed)
    const games = nfl.parse(p).games, [thu, lon] = games;
    const T = thu.kickoff.getTime(), L = lon.kickoff.getTime();
    const P = (uid, g, team, at, me = null, extra = {}) => Object.assign({id: week.nflPickId(uid, g.id), uid, game: g.id, team, me, nick: uid, at}, extra);
    const docs = [
      P('a', thu, 'PIT', T - 1),                   // just in time
      P('b', thu, 'CLE', T),                       // at kickoff: late
      P('c', thu, 'CLE', T + 3 * HOUR),            // wrong clock, hours later: late
      P('d', thu, 'CLE', null),                    // no server time
      P('e', lon, 'IND', T + HOUR),                // after Thursday's kickoff but before London's: counts
      P('f', lon, 'NE', T),                        // not one of the teams
      P('g', lon, 'WSH', L - MIN, null, {id: 'z__401872965'}), // id does not match its uid
      {uid: 'h', game: '401879999', team: 'PIT', nick: 'h', at: T - HOUR}, // not a game this week
      P('i', thu, 'pit', {seconds: (T - HOUR) / 1000, nanoseconds: 0}), // a Firestore Timestamp; team case-folded
      // `kick`: the kickoff the doc was saved against (the rules lock the doc at it).
      P('k1', lon, 'IND', T, null, {kick: {seconds: L / 1000, nanoseconds: 0}}), // London's own kickoff: counts
      P('k2', lon, 'WSH', T, null, {kick: new Date(L - DAY)}),                   // an earlier kickoff (game moved later): counts
      P('k3', lon, 'WSH', T, null, {kick: L + HOUR}),                            // claims a later kickoff (still editable after the game): never counts
      P('k4', lon, 'WSH', T, null, {kick: 'soon'})                               // malformed
    ];
    const rows = week.nflRowsFrom(docs, games, null);
    const who = rows.map(r => r.uid).sort().join();
    const t = week.tallyNfl(docs, games, 'a', {at: L - MIN});
    const pass = who === 'a,e,i,k1,k2' && t.byGame[thu.id].n === 2 && t.byGame[lon.id].n === 3 && t.byGame[thu.id].away === 2 && t.byGame[thu.id].home === 0;
    return {pass, detail: `counted ${who} (expected a,e,i,k1,k2); Thu ${t.byGame[thu.id].away} PIT / ${t.byGame[thu.id].home} CLE; London ${t.byGame[lon.id].n} in`};
  });

  // 5b. One person across phones (Safari and the home-screen app keep separate identities)
  check('Your picks follow you across phones: older docs with only a nick count as that manager, and clearing on one phone clears the other', () => {
    need();
    const p = clone(W4);
    const games = nfl.parse(p).games, [, lon, mon] = games;
    const L = lon.kickoff.getTime(), E = mgr('evan');
    const at = L - 2 * HOUR;
    // Phone A (an older build: no manager on the doc, nick "Evan") picked both; phone B (Evan) cleared Monday later.
    const docs = [
      {id: week.nflPickId('A', lon.id), uid: 'A', game: lon.id, team: 'IND', me: null, nick: data.name(E), at: at - 3 * HOUR},
      {id: week.nflPickId('A', mon.id), uid: 'A', game: mon.id, team: mon.home.abbr, me: null, nick: data.name(E), at: at - 3 * HOUR},
      {id: week.nflPickId('B', mon.id), uid: 'B', game: mon.id, team: '', me: E, nick: data.name(E), at: at - HOUR}
    ];
    const t = week.tallyNfl(docs, games, 'B', {at, me: E});
    const pass = t.mine[lon.id] === 'IND' && t.mine[mon.id] === undefined && t.count === 1 && t.byGame[lon.id].n === 1 && t.byGame[mon.id].n === 0;
    return {pass, detail: `phone B sees ${JSON.stringify(t.mine)} (London ${t.byGame[lon.id].n} in, Monday ${t.byGame[mon.id].n} in)`};
  });

  // 6. Reveal
  check('Reveal: others\' picks show once ESPN has the game started (never on the phone\'s clock); before, only the count and your own', () => {
    need();
    const p = clone(W4);
    setGame(p, '401872964', 'post', 20, 17); // Thursday is over
    const games = nfl.parse(p).games, [thu, lon, mon] = games;
    const T = thu.kickoff.getTime(), L = lon.kickoff.getTime();
    const E = mgr('evan'), M = mgr('mitch'), S = mgr('mason');
    const P = (uid, g, team, at, me) => ({id: week.nflPickId(uid, g.id), uid, game: g.id, team, me, nick: data.name(me), at});
    const docs = [
      P('me', thu, 'PIT', T - HOUR, E), P('me', lon, 'IND', T - 2 * HOUR, E),
      P('m1', thu, 'CLE', T - 3 * HOUR, M), P('m1', lon, 'WSH', T - 3 * HOUR, M), P('m1', mon, 'ATL', T - 3 * HOUR, M),
      P('s1', lon, 'IND', L - MIN, S), P('s1', thu, 'PIT', T + MIN, S)
    ];
    const at = ms('2026-10-03T12:00Z'); // Saturday: Thursday's game is over, London and Monday are still open
    const t = week.tallyNfl(docs, games, 'me', {at, me: E});
    const bt = t.byGame[thu.id], bl = t.byGame[lon.id], bm = t.byGame[mon.id];
    const thuOk = bt.revealed && bt.locked && bt.away === 1 && bt.home === 1 && bt.n === 2 && bt.voters.away[0].uid === 'me' && bt.voters.away[0].you
      && bt.voters.home[0].uid === 'm1' && bt.mine === 'away';
    const hidden = !bl.revealed && !bl.locked && bl.n === 3 && bl.home === 0 && bl.away === 0 && !bl.voters.home.length && !bl.voters.away.length && bl.mine === 'away'
      && !bm.revealed && bm.n === 1 && bm.mine === null;
    const picks = t.picks.map(p => p.uid + ':' + p.game.slice(-2) + ':' + p.team).join(' ');
    const mine = JSON.stringify(t.mine) === JSON.stringify({[thu.id]: 'PIT', [lon.id]: 'IND'}) && t.count === 2;
    // A phone clock at (or past) London's kickoff locks it, but its picks stay hidden until ESPN shows it started.
    const t1 = week.tallyNfl(docs, games, 'me', {at: L + HOUR, me: E});
    const clock = t1.byGame[lon.id].locked && !t1.byGame[lon.id].revealed && t1.byGame[lon.id].home === 0 && !t1.picks.some(x => x.game === lon.id && x.uid !== 'me');
    // ESPN shows London live: its picks open up; Monday's stay hidden.
    const t2 = week.tallyNfl(docs, nfl.parse(setGame(clone(p), '401872965', 'in', 7, 3)).games, 'me', {at: L, me: E});
    const later = t2.byGame[lon.id].revealed && t2.byGame[lon.id].away === 2 && t2.byGame[lon.id].home === 1 && !t2.byGame[mon.id].revealed;
    // Your other phone (or Safari vs the home-screen app: another uid, same manager): before kickoff it sees your
    // picks (the one that counts for your manager) and only the count of everyone else's.
    const imp = week.tallyNfl(docs, games, 'someone-else', {at, me: E});
    const impostor = imp.mine[lon.id] === 'IND' && imp.byGame[lon.id].mine === 'away' && imp.byGame[lon.id].n === 3
      && imp.picks.filter(x => x.game === lon.id).map(x => x.uid).join() === 'me' && imp.mine[thu.id] === 'PIT' && imp.count === 2;
    const pass = thuOk && hidden && mine && clock && later && impostor && picks === 'm1:64:CLE me:64:PIT me:65:IND';
    return {pass, detail: `Saturday: ${picks}; London ${bl.n} in (hidden; still hidden on a clock past kickoff: ${clock}); ESPN live: ${t2.byGame[lon.id].away} IND / ${t2.byGame[lon.id].home} WSH; your other phone sees ${JSON.stringify(imp.mine)}`};
  });

  // 7. Grading
  check('Grading: right when your team won a final game; ties and postponed games are no pick; live is pending', () => {
    const g3 = nfl.parse(clone(W3)).games;
    const atl = g3[0];
    const tie = nfl.parse(setGame(clone(W3), '401872948', 'post', 20, 20)).games[0];
    const p = clone(W4);
    setGame(p, '401872964', 'in', 17, 10); setGame(p, '401872965', 'postponed', 0, 0);
    const [live, pp] = nfl.parse(p).games;
    const G = week.gradeNfl;
    const pass = G(atl, 'ATL') === 'right' && G(atl, 'GB') === 'wrong' && G(atl, null) === null && G(atl, '') === null
      && tie.tie && !tie.winner && G(tie, 'ATL') === 'push' && G(tie, 'GB') === 'push'
      && G(live, 'CLE') === 'pending' && G(pp, 'IND') === 'push'
      && g3.every(g => G(g, g[g.winner].abbr) === 'right' && G(g, g[g.winner === 'home' ? 'away' : 'home'].abbr) === 'wrong');
    return {pass, detail: `ATL right, GB wrong; 20–20 tie ${G(tie, 'ATL')}; live ${G(live, 'CLE')}; postponed ${G(pp, 'IND')}`};
  });

  // 8. Week table and season standings
  check('Standings: week and season tables, one row per manager across two phones, nick-only per uid, ranked by right then fewer wrong', () => {
    need();
    const E = mgr('evan'), M = mgr('mitch'), J = mgr('john');
    const g3 = nfl.parse(clone(W3)).games;
    const p4 = clone(W4);
    setGame(p4, '401872964', 'post', 20, 17);   // CLE beat PIT
    setGame(p4, '401872965', 'post', 23, 23);   // London: a tie
    setGame(p4, '401872979', 'in', 10, 14);     // Monday night: live
    const g4 = nfl.parse(p4).games, [thu, lon, mon] = g4;
    const k = g => g.kickoff.getTime();
    const P = (uid, g, team, dt, me, nick) => ({id: week.nflPickId(uid, g.id), uid, game: g.id, team, me: me || null, nick: nick || (me ? data.name(me) : uid), at: k(g) + dt});
    const win = g => g[g.winner].abbr, lose = g => g[g.winner === 'home' ? 'away' : 'home'].abbr;
    const D3 = [
      // Evan on two phones: the home-screen app's pick is newer and wins; an empty pick clears the other phone's.
      P('e1', g3[0], win(g3[0]), -2 * HOUR, E), P('e2', g3[0], lose(g3[0]), -HOUR, E),
      P('e1', g3[1], win(g3[1]), -HOUR, E), P('e2', g3[2], win(g3[2]), -HOUR, E),
      P('e1', g3[5], win(g3[5]), -2 * HOUR, E), P('e2', g3[5], '', -HOUR, E),
      // Mitch: every game but one wrong pick (game 6) and a Monday pick made after kickoff.
      ...g3.slice(0, 15).map((g, i) => P('m1', g, i === 5 ? lose(g) : win(g), -HOUR, M)), P('m1', g3[15], win(g3[15]), 5 * MIN, M),
      // John: three right.
      P('j1', g3[3], win(g3[3]), -HOUR, J), P('j1', g3[4], win(g3[4]), -HOUR, J), P('j1', g3[6], win(g3[6]), -HOUR, J),
      // Two nick-only players with the same nick: two rows.
      P('f1', g3[0], win(g3[0]), -HOUR, null, 'Fan'), P('f2', g3[0], lose(g3[0]), -HOUR, null, 'Fan')
    ];
    const D4 = [P('e2', thu, 'CLE', -HOUR, E), P('e1', lon, 'IND', -HOUR, E), P('e2', mon, 'ATL', -HOUR, E),
      P('m1', thu, 'PIT', -HOUR, M), P('m1', lon, 'WSH', -HOUR, M)];
    const fmt = r => `${r.me || r.nick}:${r.right}-${r.wrong}:#${r.rank}`;
    const wk = week.nflRowsFrom(D3, g3, 'e1', {me: E});
    const wkGot = wk.map(fmt).join(' ');
    const wkWant = `mitch:14-1:#1 john:3-0:#2 evan:2-1:#3 Fan:1-0:#4 Fan:0-1:#5`;
    const ev = wk.find(r => r.me === E);
    const evOk = ev && ev.you && ev.uid === 'e2' && ev.picked === 3 && ev.decided === 3 && wk.filter(r => r.you).length === 1 && ev.who.name === data.name(E) && ev.name === data.name(E) && ev.who.me === E;
    const mt = wk.find(r => r.me === M);
    const mtOk = mt && mt.picked === 15 && mt.decided === 15 && !mt.you;
    const season = week.nflStandingsFrom([{year: 2026, week: 3, games: g3, docs: D3}, {year: 2026, week: 4, games: g4, docs: D4}], 'e1', {me: E});
    const sGot = season.map(r => `${fmt(r)}:${r.weeks}w`).join(' ');
    const sWant = `mitch:14-2:#1:2w john:3-0:#2:1w evan:3-1:#3:2w Fan:1-0:#4:1w Fan:0-1:#5:1w`;
    const se = season.find(r => r.me === E);
    const seOk = se && se.pushes === 1 && se.pending === 1 && se.picked === 6 && se.decided === 4 && Math.abs(se.pct - .75) < 1e-9 && se.you
      && season.find(r => r.me === M).pushes === 1 && season.filter(r => r.you).length === 1;
    // Your row is found by your manager even from a third phone that never picked.
    const third = week.nflStandingsFrom([{year: 2026, week: 3, games: g3, docs: D3}], 'e3', {me: E}).find(r => r.you);
    // A rank is shared only when right and wrong are both equal.
    const tie = week.nflRowsFrom([P('x1', g3[0], win(g3[0]), -HOUR, null, 'X'), P('x2', g3[1], win(g3[1]), -HOUR, null, 'Y'), P('x3', g3[2], lose(g3[2]), -HOUR, null, 'Z')], g3, null);
    const shared = tie.map(r => r.rank).join() === '1,1,3';
    const pass = wkGot === wkWant && evOk && mtOk && sGot === sWant && seOk && !!third && third.me === E && shared;
    return {pass, detail: `week 3: ${wkGot}; season: ${sGot}`};
  });

  // 9. Doc ids match the rules
  check('Pick doc ids match the rules: {uid}__{gameId} with a 1–12 digit ESPN id', () => {
    const uid = 'Xy9AbC0dEfGhIjKlMnOpQrStUv12';
    const ids = nfl.parse(clone(W3)).games.map(g => week.nflPickId(uid, g.id));
    const re = new RegExp('^' + uid + '__[0-9]{1,12}$');
    const pass = ids.every(id => re.test(id)) && !re.test(week.nflPickId('someone-else', '401872948')) && week.weekKey(2026, 4) === '2026-w4';
    return {pass, detail: ids[0]};
  });

  // 10-14. Pick, then submit: drafts on the phone, one submit for every change.
  let pk = null, pkErr = null;
  try { pk = await import('../views/pickem.js'); } catch (e) { pkErr = e; }
  const needPk = () => { if (!pk) throw new Error('views/pickem.js did not load: ' + ((pkErr && pkErr.message) || pkErr)); };
  const J = o => JSON.stringify(o);

  check('Submit: a draft equal to the submitted pick is no change; a clear is a change only when something is submitted', () => {
    const saved = {'401872964': 'PIT', '401872965': 'IND'};
    const ch = week.pickChanges({'401872964': 'pit', '401872965': 'WSH', '401872979': 'ATL', '401872966': '', '401872967': 7}, saved);
    const clear = week.pickChanges({'401872965': ''}, saved);
    const none = week.pickChanges({}, saved), same = week.pickChanges(saved, saved);
    const pass = J(ch) === J({'401872965': 'WSH', '401872979': 'ATL'}) && J(clear) === J({'401872965': ''}) && J(none) === '{}' && J(same) === '{}';
    return {pass, detail: `changes ${J(ch)}; a clear of IND ${J(clear)}; drafts equal to saved ${J(same)}`};
  });

  check('Drafts: the store round-trips through localStorage, drops junk, and sweeps weeks before the current one', () => {
    needPk();
    const Y = 1999, k1 = pk.drafts.key(Y, 1), k5 = pk.drafts.key(Y, 5);
    try {
      pk.drafts.set(Y, 5, {'401872964': 'pit', '401872965': '', x: 'PIT', '401872966': 'TOOLONG', '401872967': 7});
      const raw = JSON.parse(localStorage.getItem(k5) || 'null');
      const back = pk.drafts.get(Y, 5, {fresh: true});
      const round = J(back) === J({'401872964': 'PIT', '401872965': ''}) && J(raw) === J(back) && k5 === 'gg-pk-draft-1999-w5';
      pk.drafts.set(Y, 1, {'401872964': 'CLE'});
      const swept = pk.drafts.sweep({year: Y, week: 3});
      const gone = localStorage.getItem(k1) === null && localStorage.getItem(k5) !== null && J(pk.drafts.get(Y, 1)) === '{}';
      pk.drafts.set(Y, 5, {});
      const empty = localStorage.getItem(k5) === null && J(pk.drafts.get(Y, 5, {fresh: true})) === '{}';
      return {pass: round && swept === 1 && gone && empty, detail: `read back ${J(back)}; week 1 swept at week 3: ${gone}; emptied: ${empty}`};
    } finally { localStorage.removeItem(k1); localStorage.removeItem(k5); }
  });

  check('Drafts: at kickoff a game\'s draft is dropped and named (it never counts); drafts equal to the submitted pick go once picks are known', () => {
    needPk();
    const games = nfl.parse(clone(W4)).games, [thu, lon, mon] = games;
    const T = thu.kickoff.getTime();
    const dr = {[thu.id]: 'PIT', [lon.id]: 'IND', [mon.id]: 'ATL', '401879999': 'PIT'};
    const saved = {[mon.id]: 'ATL'};
    const ids = r => J(Object.keys(r.keep).sort()) + ' / ' + r.dropped.map(g => g.id).join();
    const before = pk.pruneDrafts(dr, games, saved, T - MIN);   // nothing kicked off: Monday's equals saved, the unknown game goes
    const at = pk.pruneDrafts(dr, games, saved, T);             // Thursday kicks off: its draft goes, named
    const unknown = pk.pruneDrafts(dr, games, null, T);         // picks not known yet: Thursday goes unnamed, Monday stays
    const same = pk.pruneDrafts({[thu.id]: 'PIT'}, games, {[thu.id]: 'PIT'}, T); // equal to the submitted pick: nothing lost
    const pass = J(before.keep) === J({[thu.id]: 'PIT', [lon.id]: 'IND'}) && !before.dropped.length
      && J(at.keep) === J({[lon.id]: 'IND'}) && at.dropped.length === 1 && at.dropped[0].id === thu.id
      && J(unknown.keep) === J({[lon.id]: 'IND', [mon.id]: 'ATL'}) && !unknown.dropped.length
      && J(same.keep) === '{}' && !same.dropped.length;
    return {pass, detail: `before kickoff ${ids(before)}; at Thursday's kickoff ${ids(at)}; picks unknown ${ids(unknown)}`};
  });

  check('Tab dot: on while a draft isn\'t submitted (even with every game submitted), off once it is or its game kicks off', () => {
    needPk();
    const games = nfl.parse(clone(W4)).games, [thu, lon, mon] = games;
    const at = thu.kickoff.getTime() - HOUR;
    const all = {[thu.id]: 'PIT', [lon.id]: 'IND', [mon.id]: 'ATL'};
    const a = pk.badgeFrom({games, saved: all, drafts: {}, at});
    const b = pk.badgeFrom({games, saved: all, drafts: {[lon.id]: 'WSH'}, at});
    const c = pk.badgeFrom({games, saved: all, drafts: {[lon.id]: 'IND'}, at});
    const d = pk.badgeFrom({games, saved: {}, drafts: all, at});
    const e = pk.badgeFrom({games, saved: all, drafts: {[thu.id]: 'CLE'}, at: thu.kickoff.getTime()});
    const pass = !a.on && b.on && b.unsent === 1 && b.due.length === 1 && !c.on && d.on && d.unsent === 3 && d.due.length === 3 && !e.on && e.unsent === 0;
    return {pass, detail: `all submitted ${a.on}; one draft ${b.on} (${b.unsent} unsent); draft equal to submitted ${c.on}; drafts only ${d.on} (${d.due.length} due); drafted game kicked off ${e.on}`};
  });

  check('Submit: submitPicks on the dev stand-in with an injected clock maps each game (kicked off -> locked, the rest saved; forced errors save nothing)', async () => {
    if (!week.__dev || !week.__dev.standIn()) return {pass: true, detail: 'skipped: this page can write to the real database'};
    const games = nfl.parse(clone(W4)).games, [thu, lon, mon] = games;
    const Y = 2099, W = 4, key = week.weekKey(Y, W); // a test week nobody plays
    const at = thu.kickoff.getTime() + MIN;           // Thursday has kicked off; London and Monday are open
    const mineIn = () => { const w = (week.__dev.store().nflpicks || {})[key] || {}; return Object.values(w).filter(d => d.uid === week.myUid()).map(d => d.game.slice(-2) + ':' + d.team).sort().join(); };
    const res = r => `ok ${r.ok.map(x => x.slice(-2))} locked ${r.locked.map(x => x.slice(-2))} failed ${r.failed.map(x => x.slice(-2))} ${r.code}`;
    try {
      const r1 = await week.submitPicks(Y, W, {[thu.id]: 'PIT', [lon.id]: 'home', [mon.id]: 'ATL'}, {games, at});
      const s1 = mineIn();
      const r2 = await week.submitPicks(Y, W, {[lon.id]: 'IND', [mon.id]: ''}, {games, at}); // a change and a clear
      const s2 = mineIn();
      const r3 = await week.submitPicks(Y, W, {[thu.id]: 'CLE'}, {games, at});              // every game kicked off
      const r4 = await week.submitPicks(Y, W, {'401879999': 'PIT', [mon.id]: 'NE'}, {games, at}); // unknown game, wrong team
      week.__dev.fail('denied');
      const r5 = await week.submitPicks(Y, W, {[mon.id]: 'NO', [thu.id]: 'PIT'}, {games, at});
      week.__dev.fail('failed');
      const r6 = await week.submitPicks(Y, W, {[mon.id]: 'NO'}, {games, at});
      week.__dev.fail(null);
      const s6 = mineIn();
      const pass = J(r1.ok) === J([lon.id, mon.id]) && J(r1.locked) === J([thu.id]) && !r1.failed.length && r1.code === 'dev' && s1 === '65:WSH,79:ATL'
        && J(r2.ok) === J([lon.id, mon.id]) && r2.code === 'dev' && s2 === '65:IND'
        && !r3.ok.length && J(r3.locked) === J([thu.id]) && r3.code === 'locked'
        && J(r4.failed.slice().sort()) === J([mon.id, '401879999']) && !r4.ok.length && r4.code === 'failed'
        && J(r5.failed) === J([mon.id]) && J(r5.locked) === J([thu.id]) && r5.code === 'denied' && J(r6.failed) === J([mon.id]) && r6.code === 'failed' && s6 === '65:IND';
      return {pass, detail: `1: ${res(r1)} (saved ${s1}); 2: ${res(r2)} (saved ${s2}); all kicked off: ${res(r3)}; bad: ${res(r4)}; denied: ${res(r5)}; failed: ${res(r6)}`};
    } finally {
      week.__dev.fail(null);
      dropTestWeek(key);
    }
  });

  check('Submit: a write the server hasn\'t confirmed counts as what it replaces (saved), so a failed or lost submit keeps its drafts', () => {
    const games = nfl.parse(clone(W4)).games, [thu, lon, mon] = games;
    const T = thu.kickoff.getTime();
    const P = (g, team, at, x) => Object.assign({id: week.nflPickId('me', g.id), uid: 'me', game: g.id, team, at, kick: g.kickoff.getTime()}, x);
    const before = {thu: P(thu, 'CLE', T - DAY), lon: P(lon, 'IND', T - DAY)};
    // Firestore's local echo of a submit on its way: Thursday changed to PIT, London deleted (gone from the snapshot),
    // Monday new; all three writes still out. Someone else's London pick is confirmed.
    const other = P(lon, 'WSH', T - DAY, {id: week.nflPickId('other', lon.id), uid: 'other'});
    const docs = [P(thu, 'PIT', T - HOUR, {pending: true}), P(mon, 'ATL', T - HOUR, {pending: true}), other];
    const flying = new Map([[before.thu.id, {before: before.thu}], [before.lon.id, {before: before.lon}], [week.nflPickId('me', mon.id), {before: null}]]);
    const mineOf = d => week.tallyNfl(d, games, 'me', {at: T - HOUR}).mine;
    const shown = mineOf(docs), saved = mineOf(week.confirmedDocs(docs, flying));
    // No write out and no pending doc: the docs themselves. A pending doc nobody tracks (never confirmed) doesn't count.
    const plain = week.confirmedDocs([other], new Map())[0] === other && week.confirmedDocs([other], null).length === 1;
    const stray = mineOf(week.confirmedDocs([P(thu, 'PIT', T - HOUR, {pending: true})], null));
    // The screen: drafts equal to the echo are still changes against saved (nothing prunes them while it's unconfirmed).
    const ch = week.pickChanges({[thu.id]: 'PIT', [lon.id]: '', [mon.id]: 'ATL'}, saved);
    const pass = J(shown) === J({[thu.id]: 'PIT', [mon.id]: 'ATL'}) && J(saved) === J({[thu.id]: 'CLE', [lon.id]: 'IND'}) && plain && J(stray) === '{}'
      && J(ch) === J({[thu.id]: 'PIT', [lon.id]: '', [mon.id]: 'ATL'});
    return {pass, detail: `the snapshot shows ${J(shown)}; saved (confirmed) ${J(saved)}; changes still to submit ${J(ch)}`};
  });

  check('Submit: "denied" (switched off) only when the rules refused everything and nothing saved; a partial submit is "failed"', () => {
    const c = (ok, locked, failed, denied) => week.submitCode({ok: Array(ok).fill('x'), locked: Array(locked).fill('y'), failed: Array(failed).fill('z')}, denied);
    const got = [c(2, 0, 0, 0), c(0, 2, 0, 0), c(1, 1, 0, 0), c(0, 0, 2, 2), c(1, 0, 1, 1), c(0, 0, 2, 1), c(0, 1, 1, 1), c(0, 0, 1, 0)];
    const want = ['ok', 'locked', 'ok', 'denied', 'failed', 'failed', 'denied', 'failed'];
    return {pass: J(got) === J(want), detail: got.join(' ')};
  });

  // Locking in
  check('Lock in: a locked-in manager\'s picks made after the lock never count, from any phone; earlier ones do; a phone without a manager binds only its own uid', () => {
    need();
    const p = clone(W4);
    setGame(p, '401872964', 'post', 20, 17); // Thursday is over (CLE won): its picks are revealed
    const games = nfl.parse(p).games, [thu, lon, mon] = games;
    const T = thu.kickoff.getTime(), L = T - 2 * HOUR; // everyone below locks two hours before Thursday's kickoff
    const E = mgr('evan'), M = mgr('mitch'), S = mgr('mason');
    const P = (uid, g, team, at, me, nick) => ({id: week.nflPickId(uid, g.id), uid, game: g.id, team, me: me || null, nick: nick || (me ? data.name(me) : uid), at});
    const K = (uid, at, me, nick, n = 3, x = {}) => Object.assign({id: uid, uid, me: me || null, nick: nick || (me ? data.name(me) : uid), at, n}, x);
    const docs = [
      P('e1', thu, 'PIT', L - HOUR, E),          // Evan, before his lock: counts
      P('e1', mon, 'ATL', L + 5 * MIN, E),       // the locked phone after its lock (the rules refuse it): never counts
      P('e2', thu, 'CLE', L + 10 * MIN, E),      // Evan's second phone after the lock: never counts (PIT stands)
      P('e2', lon, 'IND', L + 30 * MIN, E),      // the same: never counts
      P('m1', thu, 'CLE', L + HOUR, M),          // Mitch never locked: counts
      P('s2', lon, 'WSH', L - MIN, S),           // Mason's other phone before his lock: counts
      P('s2', mon, 'NO', L + MIN, S),            // after it: never counts
      P('f1', lon, 'IND', L + MIN, null, 'Fan'), // a phone without a manager, after its own lock: never counts
      P('f2', lon, 'IND', L + MIN, null, 'Fan')  // another phone with the same nick, no lock: counts
    ];
    const locks = [K('e1', L, E), K('s1', L, S), K('f1', L, null, 'Fan'), K('zz', L - DAY, M, 'Mitch', 3, {id: 'not-zz'})]; // the last: its id isn't its uid
    const fmt = r => `${r.me || r.uid}:${r.picked}${r.locked != null ? 'L' : ''}`;
    const rows = week.nflRowsFrom(docs, games, 'e1', {me: E, locks}).map(fmt).sort().join(' ');
    const open = week.nflRowsFrom(docs, games, 'e1', {me: E}).map(fmt).sort().join(' ');
    // Evan's second phone: its own late London pick is gone; Thursday (revealed) shows the pick that counts for Evan.
    const t2 = week.tallyNfl(docs, games, 'e2', {at: T + HOUR, me: E, locks});
    const lk1 = week.nflLocks(locks, 'e1', {me: E}), lk2 = week.nflLocks(locks, 'e2', {me: E}), lk3 = week.nflLocks(locks, 'm1', {me: M});
    const people = lk1.list.map(x => x.key).sort().join();
    const pass = rows === 'evan:1L f2:1 mason:1L mitch:1' && open === 'evan:3 f1:1 f2:1 mason:2 mitch:1'
      && J(t2.mine) === J({[thu.id]: 'PIT'}) && t2.byGame[lon.id].n === 2 && t2.byGame[thu.id].away === 1 && t2.byGame[thu.id].home === 1
      && lk1.mine && lk1.mine.own && lk1.mine.at === L && lk2.mine && !lk2.mine.own && lk2.mine.uid === 'e1' && !lk3.mine
      && lk1.count === 3 && people === 'm:evan,m:mason,u:f1' && lk1.list.find(x => x.me === E).you && !lk3.list.some(x => x.you);
    return {pass, detail: `with locks: ${rows}; without: ${open}; Evan's 2nd phone sees ${J(t2.mine)}; locked: ${people}`};
  });

  check('Lock in: lockPicks / unlockPicks on the dev stand-in (undo only within 2 minutes; a locked phone submits nothing; "denied" when locks are off)', async () => {
    if (!week.__dev || !week.__dev.standIn()) return {pass: true, detail: 'skipped: this page can write to the real database'};
    const games = nfl.parse(clone(W4)).games, [, lon] = games;
    const Y = 2099, W = 5, key = week.weekKey(Y, W); // a test week nobody plays
    const t0 = games[0].kickoff.getTime() - DAY;       // a day before the first kickoff: every game is open
    const mine = () => { const o = (week.__dev.store().nfllocks || {})[key] || {}; const d = o[week.myUid()]; return d ? `${d.n}@${(d.at - t0) / MIN}m` : 'none'; };
    const picks = () => Object.values((week.__dev.store().nflpicks || {})[key] || {}).filter(d => d.uid === week.myUid()).map(d => d.team).join() || 'none';
    // The submitPicks check above forces the stand-in's errors (__dev.fail) while it runs; it never waits on a timer,
    // so one turn of the event loop lets it finish first.
    await new Promise(r => setTimeout(r, 0));
    try {
      const l1 = await week.lockPicks(Y, W, {n: 3, at: t0});
      const s1 = mine();
      const l2 = await week.lockPicks(Y, W, {n: 9, at: t0 + MIN});          // already locked: nothing changes
      const sub = await week.submitPicks(Y, W, {[lon.id]: 'IND'}, {games, at: t0 + MIN});
      const u1 = await week.unlockPicks(Y, W, {at: t0 + week.LOCK_UNDO_MS}); // the window is over
      const s2 = mine();
      const u2 = await week.unlockPicks(Y, W, {at: t0 + MIN});               // within it
      const s3 = mine();
      const sub2 = await week.submitPicks(Y, W, {[lon.id]: 'IND'}, {games, at: t0 + 2 * MIN});
      week.__dev.failLocks('denied');
      const d1 = await week.lockPicks(Y, W, {n: 1, at: t0 + 3 * MIN});
      week.__dev.failLocks('failed');
      const f1 = await week.lockPicks(Y, W, {n: 1, at: t0 + 3 * MIN});
      week.__dev.failLocks(null);
      const s4 = mine();
      const pass = l1 === 'dev' && s1 === '3@0m' && l2 === 'dev' && sub.code === 'lockedin' && J(sub.lockedIn) === J([lon.id]) && !sub.ok.length && !sub.locked.length
        && u1 === 'locked' && s2 === '3@0m' && u2 === 'dev' && s3 === 'none' && sub2.code === 'dev' && J(sub2.ok) === J([lon.id]) && picks() === 'IND'
        && d1 === 'denied' && f1 === 'failed' && s4 === 'none' && week.LOCK_UNDO_MS === 2 * MIN;
      return {pass, detail: `lock ${l1} (${s1}); again ${l2}; submit while locked ${sub.code}; undo at 2 min ${u1} (${s2}); at 1 min ${u2} (${s3}); submit after ${sub2.code}; locks off: ${d1}, failing: ${f1}`};
    } finally {
      week.__dev.failLocks(null);
      dropTestWeek(key);
    }
  });

  check('Lock in: a lock the server hasn\'t confirmed (pending) binds nothing and counts for nobody, but shows as yours ("Locking in…"); a phone stays bound by the manager its own picks carry', () => {
    need();
    const games = nfl.parse(clone(W4)).games, [thu, lon] = games;
    const L = thu.kickoff.getTime() - 2 * HOUR;
    const E = mgr('evan'), M = mgr('mitch');
    const P = (uid, g, team, at) => ({id: week.nflPickId(uid, g.id), uid, game: g.id, team, me: E, nick: 'Evan', at});
    const docs = [P('e1', thu, 'PIT', L + MIN), P('e2', lon, 'IND', L - HOUR)];
    const lock = x => [Object.assign({id: 'e1', uid: 'e1', me: E, nick: 'Evan', at: L, n: 1}, x)];
    const pend = week.nflLocks(lock({pending: true}), 'e1', {me: E});
    const fmt = r => `${r.me}:${r.picked}${r.locked != null ? 'L' : ''}`;
    const rowsP = week.nflRowsFrom(docs, games, 'e1', {me: E, locks: lock({pending: true})}).map(fmt).join();
    const rowsC = week.nflRowsFrom(docs, games, 'e1', {me: E, locks: lock()}).map(fmt).join();
    // Evan's second phone (e2) now answers "Which one are you?" with Mitch, but its own pick carries Evan: still bound.
    const b2 = week.nflLocks(lock(), 'e2', {me: M, mes: [E]}).mine, b3 = week.nflLocks(lock(), 'm1', {me: M, mes: [M]}).mine;
    const pass = !!pend.mine && pend.mine.pending === true && pend.mine.own && !pend.list.length && pend.count === 0 && rowsP === 'evan:2' && rowsC === 'evan:1L'
      && !!b2 && !b2.own && b2.uid === 'e1' && b3 === null;
    return {pass, detail: `pending: mine ${J(pend.mine)}, ${pend.count} locked in, rows ${rowsP} (confirmed: ${rowsC}); a switched phone ${b2 ? 'bound' : 'free'}; Mitch's own phone ${b3 ? 'bound' : 'free'}`};
  });

  check('Lock-ins ("5 of 12 locked in"): the counting rule\'s people (a lock without a manager never marks the manager its nick names; the locking phone\'s own nick-only picks are covered)', () => {
    needPk(); need();
    const E = mgr('evan'), M = mgr('mason'), JB = mgr('jacob');
    const snap = {
      locks: [{key: 'u:x1', uid: 'x1', uids: ['x1'], me: null, nick: 'Mason', at: 5, n: 3}, {key: 'm:evan', uid: 'e1', uids: ['e1'], me: E, nick: 'Evan', at: 6, n: 16}],
      rows: [
        {uid: 'e1', me: null, nick: 'Evan', picked: 16, locked: 6},   // Evan's phone: its picks from before it had a manager; its lock covers them
        {uid: 'e9', me: null, nick: 'Evan', picked: 2, locked: null}, // another phone called Evan, no manager: Evan's lock doesn't bind it
        {uid: 'x1', me: null, nick: 'Mason', picked: 3, locked: 5},   // a phone without a manager that locked in (itself only)
        {uid: 'm2', me: M, nick: 'Mason', picked: 7, locked: null},   // the real Mason: not locked in
        {uid: 'j1', me: null, nick: 'Jacob', picked: 4, locked: null},// no manager, nick names Jacob (who hasn't locked in): counts as Jacob
        {uid: 'f1', me: null, nick: 'Fan', picked: 2, locked: null}   // not in the league
      ]};
    const L = pk.lockIns(snap);
    const not = new Map(L.not.map(x => [x.w.key, x.picked]));
    const pass = L.count === 2 && L.list.map(x => x.w.key).join() === 'u:x1,m:evan' && !L.list.some(x => x.w.key === 'm:' + M)
      && not.get('m:' + M) === 7 && not.get('m:' + JB) === 4 && !not.has('u:j1') && not.get('u:e9') === 2 && not.get('u:f1') === 2
      && !not.has('m:' + E) && !not.has('u:e1') && !not.has('u:x1') && L.total === L.count + L.not.length;
    return {pass, detail: `locked in: ${L.list.map(x => x.w.key).join(' ')}; not yet: ${L.not.map(x => `${x.w.key}:${x.picked}`).join(' ')}; ${L.count} of ${L.total}`};
  });

  check('Lock in: the tab dot is off once you are locked in (drafts and unpicked games too)', () => {
    needPk();
    const games = nfl.parse(clone(W4)).games, [thu, lon] = games;
    const at = thu.kickoff.getTime() - HOUR;
    const o = {games, saved: {[thu.id]: 'PIT'}, drafts: {[lon.id]: 'IND'}, at};
    const open = pk.badgeFrom(o), locked = pk.badgeFrom(Object.assign({}, o, {locked: true}));
    const pass = open.on && open.unsent === 1 && !locked.on && !locked.unsent && !locked.due.length;
    return {pass, detail: `open: dot ${open.on} (${open.unsent} unsent, ${open.due.length} due); locked in: dot ${locked.on}`};
  });

  check('Last-known week: the games and your picks round-trip through localStorage (dates, locks); too old, over (or past its last kickoff) or junk is not read back', () => {
    needPk();
    const TK = 'gg-pk-last-check';
    // The recorded week-4 games, moved to kick off tomorrow (the kept week is only read back before its games end).
    const now = Date.now();
    const games = nfl.parse(clone(W4)).games.map((g, i) => Object.assign({}, g, {over: false, kickoff: new Date(now + DAY + i * HOUR)}));
    const snap = {key: '1999-w5', year: 1999, week: 5, mine: {[games[0].id]: 'PIT'}, saved: {[games[0].id]: 'PIT'}, byGame: {[games[0].id]: {n: 3, revealed: false}},
      rows: [{uid: 'u', me: null, nick: 'Fan', picked: 1, right: 0, wrong: 0}], count: 1, locks: [{key: 'u:u', uid: 'u', at: 5, n: 1}], lockedMe: {at: 5, n: 1, uid: 'u', own: true},
      lockedCount: 1, locksError: null, picks: [{big: true}], error: null, ready: true};
    try {
      const saved = pk.cacheSave({year: 1999, week: 5, board: {games}, snap}, TK);
      const c = pk.cacheLoad(TK, now + HOUR);
      const g0 = c && c.board.games[0];
      const round = saved && c && c.year === 1999 && c.week === 5 && c.board.cached && c.board.games.length === 3 && g0.kickoff instanceof Date
        && g0.kickoff.getTime() === games[0].kickoff.getTime() && g0.home.abbr === 'CLE' && c.snap.cached && c.snap.ready === false
        && J(c.snap.saved) === J(snap.saved) && J(c.snap.lockedMe) === J(snap.lockedMe) && c.snap.rows.length === 1 && !c.snap.picks.length;
      // The same week again is left alone (its saved time untouched); a lock still on its way isn't kept.
      const raw = localStorage.getItem(TK).replace(/,"at":\d+\}$/, ',"at":12345}');
      localStorage.setItem(TK, raw);
      pk.cacheSave({year: 1999, week: 5, board: {games}, snap}, TK);
      const same = localStorage.getItem(TK) === raw;
      pk.cacheSave({year: 1999, week: 5, board: {games}, snap: Object.assign({}, snap, {lockedMe: {at: 9, n: 1, uid: 'u', own: true, pending: true}})}, TK);
      const pend = pk.cacheLoad(TK, now + HOUR);
      const noPend = !!pend && pend.snap.lockedMe === null && localStorage.getItem(TK) !== raw;
      const old = pk.cacheLoad(TK, now + 9 * DAY) === null;
      const late = pk.cacheLoad(TK, now + DAY + 2 * HOUR + 9 * HOUR) === null; // 9 hours after the last kickoff: surely over
      pk.cacheSave({year: 1999, week: 5, board: {games: games.map(g => Object.assign({}, g, {over: true}))}, snap}, TK);
      const over = pk.cacheLoad(TK, now) === null && late;
      localStorage.setItem(TK, '{"v":1,"k":"1999-w5","year":1999,"week":5,"board":{"games":[{"id":7}]}}');
      const junk = pk.cacheLoad(TK, now) === null;
      localStorage.setItem(TK, 'not json');
      const bad = pk.cacheLoad(TK, now) === null && pk.cacheLoad('gg-pk-last-none', now) === null;
      return {pass: round && same && noPend && old && over && junk && bad, detail: `round trip ${round}; unchanged ${same ? 'not rewritten' : 'rewritten'}; pending lock ${noPend ? 'not kept' : 'kept'}; 9 days old ${old ? 'dropped' : 'kept'}; all over ${over ? 'dropped' : 'kept'}; junk ${junk && bad ? 'dropped' : 'kept'}`};
    } finally { localStorage.removeItem(TK); }
  });

  check('Drafts: a game without a set time stops taking picks at its early lock (36 h before the placeholder), and its draft is kept', () => {
    needPk();
    const p = clone(W4);
    p.events[2].competitions[0].timeValid = false; // Monday night, time not set
    const g = nfl.parse(p).games.find(x => x.id === p.events[2].id);
    const K = g.kickoff.getTime(), D = week.pickDeadline(g);
    const dr = {[g.id]: g.home.abbr};
    const open = pk.badgeFrom({games: [g], saved: {}, drafts: dr, at: D - MIN});
    const shut = pk.badgeFrom({games: [g], saved: {}, drafts: dr, at: D + MIN});
    const kept = pk.pruneDrafts(dr, [g], {}, D + MIN);
    const pass = g.tbd && K - D === 36 * HOUR && open.on && open.unsent === 1 && !shut.on && !shut.unsent && J(kept.keep) === J(dr) && !kept.dropped.length;
    return {pass, detail: `tbd ${g.tbd}, early lock ${(K - D) / HOUR} h before; before it: dot ${open.on} (${open.unsent} unsent); after: dot ${shut.on}; draft kept ${J(kept.keep)}`};
  });
}
