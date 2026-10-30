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
  '0037236': [['286a2648', 2025, 'Donruss', 'Gridiron Kings', 'GK-AHN']], // Aidan Hutchinson
  '0039139': [['e2026c5e', 2025, 'Donruss', 'Base Set', '101']], // Jahmyr Gibbs
  '0038543': [['bbd87f01', 2025, 'Donruss', 'Base Set', '6']], // Jaxon Smith-Njigba
  'xjerryrice': [['dce40a6e', 2024, 'Topps Chrome', 'Base Set', '176']], // Jerry Rice
  '0032726': [['fdb4b05b', 2024, 'Donruss', 'Base Set', '113']], // Ka'imi Fairbairn
  '0039343': [['9207fa61', 2024, 'Topps Chrome', 'Base Set', '245']], // Kamari Lassiter
  'xlawrencetaylor': [['4f9bbace', 2025, 'Donruss', 'Canton Kings', 'CK-LTR']], // Lawrence Taylor
  '0037744': [['9b217822', 2025, 'Donruss', 'Base Set', '95']], // Trey McBride
  'xbarrysanders': [['87e3f8ab', 2025, 'Score', 'First Ballot', '8']], // Barry Sanders
  'xjimbrown': [['f4a7b560', 2017, 'Donruss', 'Base Set', '203']], // Jim Brown
  '0029592': [['12a53429', 2012, 'Topps', 'Base Set', '193']], // Kevin Zeitler
  '0034973': [['3fcfb46e', 2025, 'Donruss', 'Base Set', '274']], // Maxx Crosby
  'xreggiewhite': [['db155bd6', 2020, 'Donruss', 'Base Set', '110']], // Reggie White
  'xaarondonald': [['ae347531', 2025, 'Donruss', 'All-Time Gridiron Kings', 'ATGK-ADD']], // Aaron Donald
  'xdeionsanders': [['6ae921b6', 2025, 'Donruss', 'Base Set', '21']], // Deion Sanders
  '0035699': [['8a07c251', 2019, 'Donruss', 'Base Set', '285']], // Jamel Dean
  '0035643': [['ab489ef6', 2025, 'Donruss', 'Base Set', '52']], // Jeffery Simmons
  'xjoemontana': [['6997530b', 2025, 'Donruss', 'Downtown! Horizontal', '6']], // Joe Montana
  '0038560': [['9ec9e416', 2023, 'Donruss Optic', 'Base Set', '221']], // Jordan Battle
  '0039075': [['b0fcd71b', 2025, 'Donruss', 'Base Set', '289']], // Puka Nacua
  '0033886': [['9a3a79ff', 2025, 'Donruss', 'Base Set', '132']], // T.J. Watt
  'xwalterpayton': [['f4d8c841', 2024, 'Topps Chrome', 'Base Set', '23']], // Walter Payton
  '0036963': [['85d5b9a5', 2025, 'Donruss', 'Base Set', '81']], // Amon-Ra St. Brown
  'xanthonymuñoz': [['1528d5d5', 2024, 'Donruss', 'Base Set', '78']], // Anthony Muñoz
  '0039338': [['7da92708', 2025, 'Donruss', 'Base Set', '1']], // Brock Bowers
  '0033280': [['e4e54d0a', 2025, 'Donruss', 'Base Set', '161']], // Christian McCaffrey
  'xdanmarino': [['92700d36', 2025, 'Donruss', 'Bomb Squad', 'BS-DMO']], // Dan Marino
  'xdickbutkus': [['e54c3f74', 2024, 'Donruss', 'Base Set', '51']], // Dick Butkus
  'xedreed': [['4855b7b3', 2025, 'Donruss', 'Base Set', '176']], // Ed Reed
  '0036994': [['7437998c', 2023, 'Donruss', 'Base Set', '168']], // Ernest Jones
  'xrobgronkowski': [['9953c1e3', 2024, 'Topps Chrome', 'Base Set', '121']], // Rob Gronkowski
  'xronnielott': [['30e32c01', 2023, 'Donruss', 'Retro 2003', '15']], // Ronnie Lott
  'xadamvinatieri': [['209f8fd8', 2024, 'Donruss', 'Legend Series', '7']], // Adam Vinatieri
  'xboblilly': [['c11a8570', 2024, 'Topps Chrome', 'Base Set', '43']], // Bob Lilly
  'xbrettfavre': [['9dfab4c9', 2025, 'Donruss', 'Bomb Squad', 'BS-BFE']], // Brett Favre
  '0037834': [['7fb70609', 2025, 'Donruss', 'Base Set', '46']], // Brock Purdy
  'xbrucesmith': [['0a7525d1', 2024, 'Topps Chrome', 'Base Set', '8']], // Bruce Smith
  '0031565': [['6a5c936e', 2025, 'Donruss', 'Base Set', '125']], // Danielle Hunter
  'xdarrellerevis': [['00bb5024', 2024, 'Topps Chrome', 'Base Set', '146']], // Darrelle Revis
  'xemmittsmith': [['96ea8a13', 2025, 'Donruss', 'Base Set', '4']], // Emmitt Smith
  'xericdickerson': [['de4288c4', 2025, 'Donruss', 'Base Set', '75']], // Eric Dickerson
  'xjjwatt': [['2b885e2c', 2024, 'Topps Chrome', 'Base Set', '82']], // J.J. Watt
  '0037248': [['53cee6fd', 2025, 'Donruss', 'Base Set', '194']], // James Cook
  'xjohnelway': [['13e21bf9', 2025, 'Donruss', 'Base Set', '255']], // John Elway
  'xjohnhannah': [['698a1909', 2024, 'Topps Chrome', 'Base Set', '129']], // John Hannah
  'xjonathanogden': [['122abf8f', 2024, 'Topps Chrome', 'Base Set', '5']], // Jonathan Ogden
  'xlancealworth': [['30eda0df', 2020, 'Donruss', 'All-Time Gridiron Kings', 'ATGK-LA']], // Lance Alworth
  'xlarryallen': [['c303b2ca', 2024, 'Topps Chrome', 'Base Set', '58']], // Larry Allen
  '0026498': [['db6e878a', 2025, 'Donruss', 'Base Set', '296']], // Matthew Stafford
  'xtonygonzalez': [['4d84e5a9', 2022, 'Donruss', 'Base Set', '280']], // Tony Gonzalez
  'xtroypolamalu': [['11426a23', 2024, 'Topps Chrome', 'Base Set', '162']], // Troy Polamalu
  '0039108': [['e7b77dc0', 2025, 'Donruss', 'Base Set', '62']], // Will Anderson Jr.
  '0038542': [['6d14e83b', 2025, 'Donruss', 'Base Set', '160']], // Bijan Robinson
  'xbrucematthews': [['3e95cb09', 2024, 'Topps Chrome', 'Base Set', '190']], // Bruce Matthews
  '0036358': [['92ce9753', 2025, 'Donruss', 'Base Set', '29']], // CeeDee Lamb
  'xchampbailey': [['948edcd4', 2024, 'Topps Chrome', 'Base Set', '200']], // Champ Bailey
  'xcharleswoodson': [['42100e96', 2025, 'Donruss', 'Base Set', '135']], // Charles Woodson
  '0039841': [['af1d70e6', 2025, 'Donruss', 'Champ is Here', 'CIH-CDN']], // Cooper DeJean
  'xdarrellgreen': [['79faa686', 2025, 'Score', 'First Ballot', '3']], // Darrell Green
  'xfrantarkenton': [['40cb3dd5', 2025, 'Score', 'Base Set', '98']], // Fran Tarkenton
  'xjackham': [['9a235ca8', 2023, 'Donruss', 'All-Time Gridiron Kings', 'ATG-14']], // Jack Ham
  '0031279': [['16942cf7', 2024, 'Donruss', 'Base Set', '218']], // Jake Matthews
  'xjuniorseau': [['b24dc757', 2000, 'Topps', 'Base Set', '34']], // Junior Seau
  '0033132': [['0ad80e50', 2023, 'Donruss', 'Base Set', '287']], // Kevin Byard
  'xmarshallfaulk': [['a198ec8a', 2025, 'Donruss', 'Canton Kings', 'CK-MFK']], // Marshall Faulk
  'xmarvinharrison': [['8c014c91', 2000, 'Topps', 'Base Set', '300']], // Marvin Harrison
  'xmikesingletary': [['991e2b27', 2025, 'Donruss', 'Canton Kings', 'CK-MSY']], // Mike Singletary
  'xraynitschke': [['90c319b1', 2002, 'Fleer Throwbacks', 'Base Set', '36']], // Ray Nitschke
  'xrodwoodson': [['74383d63', 2024, 'Topps Chrome', 'Base Set', '166']], // Rod Woodson
  '0036564': [['889a4391', 2024, 'Donruss', 'Base Set', '223']], // Talanoa Hufanga
  'xterrellowens': [['e0c6dd8a', 2025, 'Donruss', 'Base Set', '26']], // Terrell Owens
  'xwalterjones': [['df20b7f7', 2022, 'Donruss', 'Base Set', '38']], // Walter Jones
  'xbriandawkins': [['bba16172', 2025, 'Donruss', 'All-Time Gridiron Kings', 'ATGK-BDS']], // Brian Dawkins
  'xcriscarter': [['a307aca8', 2024, 'Topps Chrome', 'Base Set', '119']], // Cris Carter
  '0034351': [['6267cb27', 2025, 'Donruss', 'Champ is Here', 'CIH-DGT']], // Dallas Goedert
  'xdanfouts': [['3a1ad234', 2024, 'Topps Chrome', 'Base Set', '172']], // Dan Fouts
  '0037244': [['e854fbfe', 2022, 'Donruss', 'Base Set', '359']], // Devin Lloyd
  '0037238': [['8018af69', 2025, 'Donruss', 'Base Set', '225']], // Drake London
  '0039851': [['e1190579', 2025, 'Donruss', 'Base Set', '58']], // Drake Maye
  'xfrancoharris': [['72f52514', 2018, 'Donruss', 'All-Time Gridiron Kings', 'AGK-25']], // Franco Harris
  'xhowielong': [['5a7121ca', 2025, 'Donruss', 'Base Set', '156']], // Howie Long
  'xjimkelly': [['0fd0b22d', 2025, 'Donruss', 'Base Set', '44']], // Jim Kelly
  '0036223': [['2c36ebe3', 2025, 'Donruss', 'Base Set', '60']], // Jonathan Taylor
  '0034974': [['6e82f20b', 2025, 'Donruss', 'Base Set', '197']], // Julian Love
  'xjustintucker': [['7facf3ee', 2024, 'Donruss', 'Action All-Pros', '9']], // Justin Tucker
  'xkellenwinslow': [['cb5223cc', 2025, 'Donruss', 'The Legend Series', 'TLS-KWI']], // Kellen Winslow
  'xkurtwarner': [['93e8be8d', 2025, 'Donruss', 'Base Set', '32']], // Kurt Warner
  'xpaulwarfield': [['d8279589', 2025, 'Donruss', 'The Legend Series', 'TLS-PWA']], // Paul Warfield
  'xrandywhite': [['4f7abc50', 2025, 'Donruss', 'Canton Kings', 'CK-RWE']], // Randy White
  'xshannonsharpe': [['e822db1d', 2000, 'Topps', 'Base Set', '158']], // Shannon Sharpe
  'xterrybradshaw': [['3faf242a', 2025, 'Donruss', 'Base Set', '280']], // Terry Bradshaw
  'xtonydorsett': [['ce1bc138', 2025, 'Donruss', 'Base Set', '74']], // Tony Dorsett
  '0032071': [['7fc98f76', 2020, 'Donruss', 'Base Set', '202']], // Trent Brown
  'xwarrensapp': [['83ff64af', 2024, 'Donruss', 'Base Set', '299']], // Warren Sapp
  'xwillielanier': [['d7b25bcc', 2020, 'Donruss', 'All-Time Gridiron Kings', 'ATGK-WL']], // Willie Lanier
  'xcurtismartin': [['97ebaee1', 2022, 'Donruss', 'Base Set', '147']], // Curtis Martin
  '0034815': [['3a5b7100', 2025, 'Donruss', 'Base Set', '131']], // Fred Warner
  '0037192': [['cbb67e9a', 2025, 'Score', 'Base Set', '158']], // George Karlaftis
  '0033288': [['92d1ad35', 2025, 'Donruss', 'Base Set', '59']], // George Kittle
  'xjackyoungblood': [['899af938', 2022, 'Donruss', 'Retro 2002', '36']], // Jack Youngblood
  'xjanstenerud': [['ec2e8d1f', 2025, 'Donruss', 'The Legend Series', 'TLS-JST']], // Jan Stenerud
  'xjohnmackey': [['4e796bee', 2007, 'Donruss Classics', 'Base Set', '131']], // John Mackey
  'xjohnrandle': [['c3a2fd8c', 2024, 'Topps Chrome', 'Base Set', '114']], // John Randle
  '0036409': [['7114bad2', 2025, 'Score', 'Base Set', '139']], // Jordyn Brooks
  'xkenhouston': [['65617d0d', 2025, 'Score', 'Base Set', '299']], // Ken Houston
  'xlennymoore': [['4e5570dc', 2024, 'Panini Prizm', 'Base Set', '296']], // Lenny Moore
  'xmortenandersen': [['e867d665', 2024, 'Panini Mosaic', 'Base Set', '294']], // Morten Andersen
  'xozzienewsome': [['b1de77e3', 2025, 'Donruss', 'Base Set', '64']], // Ozzie Newsome
  'xpaulkrause': [['36f47773', 2024, 'Topps Chrome', 'Base Set', '118']], // Paul Krause
  '0038552': [['622671c6', 2025, 'Score', 'Base Set', '251']], // Riley Moss
  'xsamhuff': [['b4147426', 2007, 'Donruss Classics', 'Base Set', '145']], // Sam Huff
  'xtedhendricks': [['a96a3844', 2020, 'Donruss', 'Legends of the Fall', 'LF-TH']], // Ted Hendricks
  'xtimbrown': [['7b65f17e', 2025, 'Score', 'Men of Canton', '20']], // Tim Brown
  'xwarrenmoon': [['a1aa68a4', 2025, 'Donruss', 'Base Set', '186']], // Warren Moon
  '0035248': [['8591528f', 2024, 'Donruss Optic', 'Base Set', '61']], // Zach Allen
  '0039064': [['482c966e', 2025, 'Donruss', 'Base Set', '165']], // Zay Flowers
  'xartmonk': [['665c0883', 2025, 'Donruss', 'Base Set', '169']], // Art Monk
  '0039840': [['d1ed13fb', 2024, 'Score', 'Base Set', '399']], // Austin Booker
  '0037239': [['3e6d8781', 2025, 'Donruss', 'Base Set', '94']], // Chris Olave
  '0038124': [['d0755ba9', 2025, 'Donruss', 'Base Set', '234']], // Christian Watson
  '0032378': [['71dbf72f', 2025, 'Score', 'Base Set', '153']], // DeForest Buckner
  '0038386': [['e2dd5e60', 2025, 'Donruss', 'Champ is Here', 'CIH-JCR']], // Jalen Carter
  'xjohnriggins': [['e4cafdfb', 2024, 'Topps Chrome', 'Base Set', '194']], // John Riggins
  'xsteveatwater': [['5374a50e', 2024, 'Topps Chrome', 'Base Set', '61']], // Steve Atwater
  '0039404': [['f3163f69', 2024, 'Topps Chrome', 'Base Set', '277']], // Will Reichard
  '0041509': [['363a9aef', 2026, 'Topps Flagship Football', 'Base Set', '346']], // Arvell Reese
  '0037740': [['22c9ed76', 2025, 'Donruss', 'Base Set', '126']], // Garrett Wilson
  '0036914': [['2f56d602', 2025, 'Donruss', 'Base Set', '113']], // Greg Rousseau
  '0035642': [['c9f10e80', 2025, 'Donruss', 'Base Set', '252']], // Josh Hines-Allen
  '0037840': [['a24b3e85', 2025, 'Donruss', 'Base Set', '138']], // Kyren Williams
  '0031933': [['edec21ec', 2025, 'Donruss', 'Base Set', '136']], // Leonard Williams
  '0039337': [['04df23b6', 2025, 'Donruss', 'Base Set', '273']], // Malik Nabers
  '0032965': [['005af885', 2016, 'Score', 'Base Set', '387']], // Ronnie Stanley
  '0039065': [['0f8f2eed', 2025, 'Donruss', 'Base Set', '293']], // Sam LaPorta
  '0036410': [['0e77b0cd', 2025, 'Donruss', 'Base Set', '15']], // Tee Higgins
  '0040124': [['d8dee6c4', 2025, 'Donruss', 'Base Set', '314']], // Tetairoa McMillan
  '0039111': [['056da6da', 2023, 'Donruss', 'Base Set', '354']], // Tuli Tuipulotu
  '0040148': [['a8affd2c', 2025, 'Donruss', 'Base Set', '399']], // Xavier Watts
  '0035272': [['2aa4bc7a', 2025, 'Donruss', 'Base Set', '281']], // Andrew Van Ginkel
  '0033831': [['db6e7b1d', 2023, 'Score', 'Base Set', '300']], // Andrew Wylie
  '0039018': [['55ff57af', 2024, 'Panini Mosaic', 'Base Set', '77']], // Jack Campbell
  '0033106': [['f2ba69cb', 2025, 'Donruss', 'Base Set', '220']], // Jared Goff
  '0031492': [['010f10bb', 2025, 'Panini Phoenix', 'Base Set', '31']], // Jason Myers
  '0036997': [['ebe3a750', 2025, 'Donruss', 'Base Set', '265']], // Javonte Williams
  '0038038': [['ef680e7b', 2025, 'Donruss', 'Dominators', 'DOM-KHN']], // Kyle Hamilton
  '0036986': [['43715dbb', 2021, 'Panini Prizm', 'Base Set', '438']], // Nahshon Wright
  '0036554': [['a77c3b07', 2025, 'Donruss', 'Base Set', '206']], // Nico Collins
  '0040128': [['ec900f0b', 2025, 'Donruss', 'Base Set', '337']], // Tyler Warren
  '0036388': [['8f1ef04d', 2025, 'Donruss', 'Base Set', '189']], // Xavier McKinney
  '0040122': [['b7c2f791', 2025, 'Donruss', 'Base Set', '305']], // Ashton Jeanty
  '0039141': [['6ccaff04', 2023, 'Donruss', 'Base Set', '328']], // Brian Branch
  '0034158': [['4f58855c', 2025, 'Topps Chrome', 'Base Set', '196']], // Brian O'Neill
  '0035236': [['ea42c304', 2025, 'Donruss', 'Base Set', '137']], // Byron Murphy
  '0035358': [['474c3657', 2025, 'Panini Revolution', 'Base Set', '159']], // Chase McLaughlin
  '0036912': [['6f8daaf3', 2025, 'Donruss', 'Base Set', '34']], // DeVonta Smith
  '0032764': [['6d82e0b7', 2025, 'Donruss', 'Base Set', '153']], // Derrick Henry
  '0037240': [['0d38f2da', 2025, 'Donruss', 'Base Set', '9']], // Jameson Williams
  '0039852': [['4f7d7d32', 2025, 'Donruss', 'Base Set', '120']], // Jared Verse
  '0039340': [['2884fc63', 2024, 'Topps Chrome', 'Base Set', '247']], // Laiatu Latu
  '0035647': [['a692a885', 2025, 'Donruss', 'Base Set', '142']], // Montez Sweat
  '0039888': [['c0c4fd4c', 2025, 'Donruss', 'Base Set', '65']], // Quinyon Mitchell
  '0038996': [['fcc421e8', 2025, 'Panini Absolute', 'Draft Diamonds', 'DD-TKT']], // Tucker Kraft
  '0036418': [['37d7a6ae', 2025, 'Donruss', 'Base Set', '264']], // Zack Baun
  '0037692': [['740b1cc4', 2025, 'Donruss', 'Action All-Pros', 'AAP-BAU']], // Brandon Aubrey
  '0039838': [['9c0c4140', 2024, 'Topps Chrome', 'Base Set', '293']], // Calen Bullock
  '0036220': [['4358aa6a', 2022, 'Donruss', 'Base Set', '240']], // Derrick Brown
  '0038134': [['ef3f7016', 2025, 'Donruss', 'Base Set', '187']], // Kenneth Walker III
  '0039860': [['32634834', 2024, 'Donruss', 'Base Set', '315']], // Kool-Aid McKinstry
  '0033131': [['a0d9ce4e', 2016, 'Donruss', 'Base Set', '332']], // Maliek Collins
  '0034342': [['39210d3c', 2024, 'Donruss', 'Base Set', '116']], // Quenton Nelson
  '0034399': [['d406c52a', 2023, 'Score', 'Base Set', '209']], // Wyatt Teller
  '0034668': [['652f9351', 2021, 'Donruss', 'The Champ Is Here', 'CIH-18']], // Aaron Stinnie
  '0031898': [['b40f5b0c', 2024, 'Donruss', 'Base Set', '231']], // Alex Singleton
  '0035687': [['5f794291', 2024, 'Donruss', 'Base Set', '99']], // Bobby Okereke
  '0039309': [['a0107403', 2024, 'Topps Chrome', 'Base Set', '297']], // Byron Murphy II
  '0039137': [['8c752b19', 2024, 'Donruss', 'Base Set', '47']], // Byron Young
  '0040579': [['5e8014b1', 2025, 'Donruss', 'Base Set', '392']], // Carson Schwesinger
  '0034856': [['4de20da7', 2025, 'Score', 'Base Set', '174']], // Denzel Ward
  '0035230': [['e0ed6773', 2024, 'Panini Mosaic', 'Base Set', '26']], // Ed Oliver
  '0034495': [['1845e325', 2025, 'Panini Select', 'Base Set', '24']], // Evan Brown
  '0037838': [['cdf271ac', 2025, 'Donruss', 'Base Set', '133']], // Isaiah Likely
  '0031364': [['4df47511', 2019, 'Donruss', 'Base Set', '108']], // Jadeveon Clowney
  '0039491': [['65217e78', 2025, 'Donruss', 'Base Set', '13']], // Jalen Coker
  '0037228': [['644c7b7d', 2025, 'Donruss', 'Base Set', '200']], // Jaylen Warren
  '0034675': [['143c21d6', 2021, 'Donruss', 'Base Set', '217']], // Jessie Bates
  '0034429': [['33521d8b', 2025, 'Score', 'Base Set', '129']], // Jordan Mailata
  '0034759': [['8687e442', 2025, 'Topps Chrome', 'Base Set', '183']], // Kolton Miller
  '0039371': [['246c5662', 2024, 'Topps Chrome', 'Base Set', '256']], // Kris Abrams-Draine
  '0037250': [['15584938', 2022, 'Donruss', 'Base Set', '381']], // Martin Emerson
  '0041528': [['97e9381e', 2025, 'Bowman University Chrome', 'Base Set', '100']], // Michael Taaffe
  '0034752': [['3dc1fbf9', 2018, 'Score', 'Base Set', '416']], // Orlando Brown
  '0039067': [['5cc56162', 2025, 'Donruss', 'Base Set', '270']], // Rashee Rice
  '0035261': [['6069d76c', 2025, 'Donruss', 'Base Set', '272']], // Tony Pollard
  '0030506': [['91bc668d', 2025, 'Donruss', 'Base Set', '191']], // Travis Kelce
  '0038563': [['9351039a', 2025, 'Donruss', 'Base Set', '90']], // Tre Tucker
  '0036971': [['38cf1151', 2025, 'Donruss', 'Base Set', '216']], // Trevor Lawrence
  '0039846': [['ecb05cda', 2024, 'Topps Chrome', 'Base Set', '278']], // Tykee Smith
  '0036974': [['aa81a98a', 2023, 'Donruss', 'Base Set', '140']], // Tyson Campbell
  '0035676': [['919d0a36', 2025, 'Donruss', 'Base Set', '22']], // A.J. Brown
  '0036624': [['5ce83c72', 2021, 'Panini Rookies & Stars', 'Base Set', '175']], // Alim McNeill
  '0034836': [['a4a77ff6', 2025, 'Topps Chrome', 'Base Set', '134']], // Braden Smith
  '0033890': [['e938db97', 2025, 'Donruss', 'Base Set', '23']], // Budda Baker
  '0032762': [['ab624ab1', 2025, 'Donruss', 'Base Set', '106']], // Chris Jones
  '0034768': [['fd0da732', 2018, 'Panini Absolute', 'Base Set', '110']], // Chukwuma Okorafor
  '0034790': [['5892f223', 2019, 'Donruss', 'Base Set', '135']], // Derwin James
  '0040663': [['9c9598b3', 2025, 'Donruss', 'Base Set', '373']], // Harold Fannin Jr.
  '0039172': [['26614a6e', 2025, 'Donruss', 'Best of Instant', 'INS-JBS']], // Jake Bates
  '0036500': [['e203925b', 2025, 'Score', 'Base Set', '144']], // Jamien Sherwood
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
