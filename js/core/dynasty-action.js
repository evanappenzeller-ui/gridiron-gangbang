// Action photos (the owner, Oct 31 2026: "For rare or higher, the photo should be an action photo of the player with a
// background color to match the team", then "Where can we find live action pictures of the players that would be used for
// trading cards? There should be a clean cutout of the player in game. Remove any headshot of the legend players. All
// cards aside from the common 'basic' cards should have an action photo of them in their playing days"): the player cut
// out in game, only him, so the card's own team colours and graphic stand behind him (img/dynasty/action/<key>-v2.webp).
// Its photo is his own trading card's (core/dynasty-real.js, the owner's CardSight scans: his newest base card, else his
// first card that is a game photo), upscaled and cut out by tools/dynasty/action_photos.py; else a freely licensed
// Wikimedia Commons photo of him in uniform. Every Rare, Epic, Legendary or Mythic card of his wears it, and every Legend's
// card (core/dynasty.js setData: head 'a:<key>'); a Common card keeps its headshot, and a Legend without one shows his
// number (no Legend wears a headshot or portrait). His card up close says which card the photo is from, or credits the
// Commons photo's author, licence and page, which the licences require.
// ACTION: player key (data/dynasty.json players) -> [file, source ('card:<card id's first 8>' or the Commons file name),
// author, licence, licence URL, year].

import {REAL} from './dynasty-real.js';

// <action-photos> (written by tools/dynasty/action_photos.py)
export const ACTION = {
  "xjerryrice": ["xjerryrice-v3", "card:dce40a6e", "", "", "", 2024], // Jerry Rice
  "xlawrencetaylor": ["xlawrencetaylor-v3", "card:4f9bbace", "", "", "", 2025], // Lawrence Taylor
  "xtombrady": ["xtombrady-v4", "Tom_Brady_(2).jpg", "Keith Allison", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2009], // Tom Brady
  "xbarrysanders": ["xbarrysanders-v4", "card:87e3f8ab", "", "", "", 2025], // Barry Sanders
  "xjimbrown": ["xjimbrown-v3", "card:f4a7b560", "", "", "", 2017], // Jim Brown
  "xpeytonmanning": ["xpeytonmanning-v3", "card:3d1c7df6", "", "", "", 2022], // Peyton Manning
  "xreggiewhite": ["xreggiewhite-v3", "card:db155bd6", "", "", "", 2020], // Reggie White
  "xaarondonald": ["xaarondonald-v4", "Aaron_Donald_2020.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Aaron Donald
  "xdeionsanders": ["xdeionsanders-v3", "card:6ae921b6", "", "", "", 2025], // Deion Sanders
  "xjoemontana": ["xjoemontana-v3", "1986_Jeno's_Pizza_-_28_-_Roger_Craig_(Joe_Montana_crop).jpg", "Jeno's", "Public domain", "", 1985], // Joe Montana
  "xjohnnyunitas": ["xjohnnyunitas-v4", "Unitas-Johnny-1963.jpg", "Unknown author", "Public domain", "", 1963], // Johnny Unitas
  "xrandymoss": ["xrandymoss-v3", "card:15602fe2", "", "", "", 2022], // Randy Moss
  "xraylewis": ["xraylewis-v4", "Ray_Lewis_2007.jpg", "Mr.schultz", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2007], // Ray Lewis
  "xwalterpayton": ["xwalterpayton-v3", "card:f4d8c841", "", "", "", 2024], // Walter Payton
  "xcalvinjohnson": ["xcalvinjohnson-v3", "card:c75efa30", "", "", "", 2025], // Calvin Johnson
  "xdickbutkus": ["xdickbutkus-v3", "card:e54c3f74", "", "", "", 2024], // Dick Butkus
  "xedreed": ["xedreed-v3", "Ed_reed_ravens2012.jpg", "Maryland National Guard", "Public domain", "", 2012], // Ed Reed
  "xgalesayers": ["xgalesayers-v4", "Gale_sayers_playing.jpg", "Unknown", "Public domain", "", 1972], // Gale Sayers
  "xladainiantomli": ["xladainiantomli-v3", "card:85239958", "", "", "", 2020], // LaDainian Tomlinson
  "xrobgronkowski": ["xrobgronkowski-v3", "card:9953c1e3", "", "", "", 2024], // Rob Gronkowski
  "xronnielott": ["xronnielott-v3", "card:30e32c01", "", "", "", 2023], // Ronnie Lott
  "xadamvinatieri": ["xadamvinatieri-v3", "card:209f8fd8", "", "", "", 2024], // Adam Vinatieri
  "xboblilly": ["xboblilly-v3", "card:c11a8570", "", "", "", 2024], // Bob Lilly
  "xbrettfavre": ["xbrettfavre-v4", "David_Martin82_Brett_Favre4-Edit2.jpg", "Paul Cutler", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2007], // Brett Favre
  "xbrucesmith": ["xbrucesmith-v3", "card:0a7525d1", "", "", "", 2024], // Bruce Smith
  "xdarrellerevis": ["xdarrellerevis-v3", "card:00bb5024", "", "", "", 2024], // Darrelle Revis
  "xdrewbrees": ["xdrewbrees-v3", "New_Orleans_Saints_Quarterback,_Drew_Brees_(23262414434)_(cropped).jpg", "Tammy Anthony Baker from Louisiana", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2013], // Drew Brees
  "xemmittsmith": ["xemmittsmith-v3", "card:96ea8a13", "", "", "", 2025], // Emmitt Smith
  "xericdickerson": ["xericdickerson-v4", "1985_Police_Raiders-Rams_-_20_Eric_Dickerson_(crop).jpg", "KIIS Radio/Los Angeles Rams/Los Angeles County Sheriff's Department", "Public domain", "", 1984], // Eric Dickerson
  "xjacklambert": ["xjacklambert-v4", "Jack_Lambert_in_December_1975.JPG", "Malcolm Emmons", "Public domain", "", 1975], // Jack Lambert
  "xjjwatt": ["xjjwatt-v3", "card:2b885e2c", "", "", "", 2024], // J.J. Watt
  "xjohnelway": ["xjohnelway-v3", "card:13e21bf9", "", "", "", 2025], // John Elway
  "xjohnhannah": ["xjohnhannah-v3", "card:698a1909", "", "", "", 2024], // John Hannah
  "xjonathanogden": ["xjonathanogden-v3", "card:122abf8f", "", "", "", 2024], // Jonathan Ogden
  "xlancealworth": ["xlancealworth-v4", "card:30eda0df", "", "", "", 2020], // Lance Alworth
  "xlarryallen": ["xlarryallen-v3", "card:c303b2ca", "", "", "", 2024], // Larry Allen
  "xrogerstaubach": ["xrogerstaubach-v3", "Staubach_cowboys_qb.jpg", "Unknown author Unknown author", "Public domain", "", 1976], // Roger Staubach
  "xtonygonzalez": ["xtonygonzalez-v3", "card:4d84e5a9", "", "", "", 2022], // Tony Gonzalez
  "xtroypolamalu": ["xtroypolamalu-v3", "Troy_Polamalu_2013_(cropped).jpg", "original: Paula Lively derivative: Diddykong1130", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2013], // Troy Polamalu
  "xadrianpeterson": ["xadrianpeterson-v3", "Adrian_Peterson_Vikings.jpg", "Arvee5.0", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2012], // Adrian Peterson
  "xbartstarr": ["xbartstarr-v3", "Bart_Starr_1958.jpg", "Vintage Football Card Gallery", "Public domain", "", 1958], // Bart Starr
  "xbrucematthews": ["xbrucematthews-v3", "card:3e95cb09", "", "", "", 2024], // Bruce Matthews
  "xchampbailey": ["xchampbailey-v3", "Champ_Bailey_2010.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2010], // Champ Bailey
  "xcharleswoodson": ["xcharleswoodson-v3", "card:42100e96", "", "", "", 2025], // Charles Woodson
  "xdarrellgreen": ["xdarrellgreen-v3", "card:79faa686", "", "", "", 2025], // Darrell Green
  "xfrantarkenton": ["xfrantarkenton-v3", "card:40cb3dd5", "", "", "", 2025], // Fran Tarkenton
  "xginomarchetti": ["xginomarchetti-v3", "Gino_Marchetti_1961.jpg", "Jay Publishing", "Public domain", "", 1961], // Gino Marchetti
  "xjackham": ["xjackham-v3", "JackHamPIT.png", "Unknown author Unknown author", "Public domain", "", 1982], // Jack Ham
  "xjoenamath": ["xjoenamath-v3", "1986_Jeno's_Pizza_-_37_-_Joe_Namath_(Joe_Namath_crop).jpg", "Jeno's", "Public domain", "", 1969], // Joe Namath
  "xjoethomas": ["xjoethomas-v3", "Joe_Thomas_Cleveland_Browns.jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2011], // Joe Thomas
  "xjuniorseau": ["xjuniorseau-v3", "card:b24dc757", "", "", "", 2000], // Junior Seau
  "xmarshallfaulk": ["xmarshallfaulk-v3", "card:a198ec8a", "", "", "", 2025], // Marshall Faulk
  "xmarvinharrison": ["xmarvinharrison-v3", "Marvin_Harrison_in_2007_Training_Camp_2.jpg", "The original uploader was Djmunden at English Wikipedia .", "CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5", 2008], // Marvin Harrison
  "xmikesingletary": ["xmikesingletary-v3", "card:991e2b27", "", "", "", 2025], // Mike Singletary
  "xraynitschke": ["xraynitschke-v3", "card:90c319b1", "", "", "", 2002], // Ray Nitschke
  "xrodwoodson": ["xrodwoodson-v3", "card:74383d63", "", "", "", 2024], // Rod Woodson
  "xterrellowens": ["xterrellowens-v3", "card:e0c6dd8a", "", "", "", 2025], // Terrell Owens
  "xwalterjones": ["xwalterjones-v4", "card:df20b7f7", "", "", "", 2022], // Walter Jones
  "xbriandawkins": ["xbriandawkins-v3", "Brian_Dawkins.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2009], // Brian Dawkins
  "xcriscarter": ["xcriscarter-v3", "card:a307aca8", "", "", "", 2024], // Cris Carter
  "xdanfouts": ["xdanfouts-v4", "card:3a1ad234", "", "", "", 2024], // Dan Fouts
  "xfrancoharris": ["xfrancoharris-v4", "card:72f52514", "", "", "", 2018], // Franco Harris
  "xhowielong": ["xhowielong-v3", "card:5a7121ca", "", "", "", 2025], // Howie Long
  "xjimkelly": ["xjimkelly-v3", "card:0fd0b22d", "", "", "", 2025], // Jim Kelly
  "xjustintucker": ["xjustintucker-v3", "card:7facf3ee", "", "", "", 2024], // Justin Tucker
  "xkellenwinslow": ["xkellenwinslow-v3", "card:cb5223cc", "", "", "", 2025], // Kellen Winslow
  "xkurtwarner": ["xkurtwarner-v3", "card:93e8be8d", "", "", "", 2025], // Kurt Warner
  "xmarcusallen": ["xmarcusallen-v3", "1985_Police_Raiders-Rams_-_01_Marcus_Allen_(crop).jpg", "KIIS Radio/Los Angeles Raiders/Los Angeles County Sheriff's Department", "Public domain", "", 1984], // Marcus Allen
  "xpaulwarfield": ["xpaulwarfield-v3", "card:d8279589", "", "", "", 2025], // Paul Warfield
  "xrandywhite": ["xrandywhite-v3", "card:4f7abc50", "", "", "", 2025], // Randy White
  "xshannonsharpe": ["xshannonsharpe-v3", "card:e822db1d", "", "", "", 2000], // Shannon Sharpe
  "xterrybradshaw": ["xterrybradshaw-v3", "card:3faf242a", "", "", "", 2025], // Terry Bradshaw
  "xtonydorsett": ["xtonydorsett-v3", "card:ce1bc138", "", "", "", 2025], // Tony Dorsett
  "xwarrensapp": ["xwarrensapp-v3", "card:83ff64af", "", "", "", 2024], // Warren Sapp
  "xwillielanier": ["xwillielanier-v3", "card:d7b25bcc", "", "", "", 2020], // Willie Lanier
  "xcurtismartin": ["xcurtismartin-v3", "card:97ebaee1", "", "", "", 2022], // Curtis Martin
  "xjackyoungblood": ["xjackyoungblood-v3", "card:899af938", "", "", "", 2022], // Jack Youngblood
  "xjohnrandle": ["xjohnrandle-v3", "card:c3a2fd8c", "", "", "", 2024], // John Randle
  "xlembarney": ["xlembarney-v3", "LemBarneyDET.png", "Unknown author Unknown author", "Public domain", "", 1968], // Lem Barney
  "xlendawson": ["xlendawson-v3", "Kansas_City_Chiefs_at_Denver_Broncos_1985-12-14_(ticket)_(crop).jpg", "Denver Broncos/Unlimited Printing & Systems, Inc.", "Public domain", "", 1970], // Len Dawson
  "xlennymoore": ["xlennymoore-v3", "card:4e5570dc", "", "", "", 2024], // Lenny Moore
  "xozzienewsome": ["xozzienewsome-v3", "card:b1de77e3", "", "", "", 2025], // Ozzie Newsome
  "xpaulkrause": ["xpaulkrause-v4", "card:36f47773", "", "", "", 2024], // Paul Krause
  "xsamhuff": ["xsamhuff-v3", "card:b4147426", "", "", "", 2007], // Sam Huff
  "xtedhendricks": ["xtedhendricks-v3", "card:a96a3844", "", "", "", 2020], // Ted Hendricks
  "xwarrenmoon": ["xwarrenmoon-v3", "card:a1aa68a4", "", "", "", 2025], // Warren Moon
  "xartmonk": ["xartmonk-v4", "card:665c0883", "", "", "", 2025], // Art Monk
  "xjohnriggins": ["xjohnriggins-v3", "card:e4cafdfb", "", "", "", 2024], // John Riggins
  "xsteveatwater": ["xsteveatwater-v3", "card:5374a50e", "", "", "", 2024], // Steve Atwater
  "0032726": ["0032726-v3", "card:fdb4b05b", "", "", "", 2024], // Ka'imi Fairbairn
  "0034857": ["0034857-v4", "Josh_Allen_(30419600128).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Josh Allen
  "0037236": ["0037236-v4", "Commanders_at_Lions_(52379162544).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Aidan Hutchinson
  "0037744": ["0037744-v3", "card:9b217822", "", "", "", 2025], // Trey McBride
  "0038543": ["0038543-v3", "card:bbd87f01", "", "", "", 2025], // Jaxon Smith-Njigba
  "0039139": ["0039139-v3", "card:e2026c5e", "", "", "", 2025], // Jahmyr Gibbs
  "0039343": ["0039343-v3", "card:9207fa61", "", "", "", 2024], // Kamari Lassiter
  "0029592": ["0029592-v3", "Kevin_Zeitler.JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2015], // Kevin Zeitler
  "0034973": ["0034973-v4", "Maxx_Crosby_WFT-Raiders_DEC2021.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Maxx Crosby
  "0033886": ["0033886-v3", "card:9a3a79ff", "", "", "", 2025], // T.J. Watt
  "0035643": ["0035643-v3", "card:ab489ef6", "", "", "", 2025], // Jeffery Simmons
  "0035699": ["0035699-v3", "card:8a07c251", "", "", "", 2019], // Jamel Dean
  "0038560": ["0038560-v3", "card:9ec9e416", "", "", "", 2023], // Jordan Battle
  "0039075": ["0039075-v3", "card:b0fcd71b", "", "", "", 2025], // Puka Nacua
  "0033280": ["0033280-v3", "card:e4e54d0a", "", "", "", 2025], // Christian McCaffrey
  "0036963": ["0036963-v3", "card:85d5b9a5", "", "", "", 2025], // Amon-Ra St. Brown
  "0036994": ["0036994-v3", "card:7437998c", "", "", "", 2023], // Ernest Jones
  "0039338": ["0039338-v3", "card:7da92708", "", "", "", 2025], // Brock Bowers
  "0026498": ["0026498-v3", "card:db6e878a", "", "", "", 2025], // Matthew Stafford
  "0031565": ["0031565-v3", "card:6a5c936e", "", "", "", 2025], // Danielle Hunter
  "0037248": ["0037248-v3", "card:53cee6fd", "", "", "", 2025], // James Cook
  "0037834": ["0037834-v3", "card:7fb70609", "", "", "", 2025], // Brock Purdy
  "0039108": ["0039108-v3", "card:e7b77dc0", "", "", "", 2025], // Will Anderson Jr.
  "0031279": ["0031279-v3", "card:16942cf7", "", "", "", 2024], // Jake Matthews
  "0033132": ["0033132-v3", "card:0ad80e50", "", "", "", 2023], // Kevin Byard
  "0036358": ["0036358-v4", "Washington_at_Dallas_Photo_110_(51787382465).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // CeeDee Lamb
  "0036564": ["0036564-v3", "card:889a4391", "", "", "", 2024], // Talanoa Hufanga
  "0038542": ["0038542-v3", "2025_Commanders_at_Falcons_11.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Bijan Robinson
  "0039841": ["0039841-v3", "card:af1d70e6", "", "", "", 2025], // Cooper DeJean
  "0032071": ["0032071-v3", "card:7fc98f76", "", "", "", 2020], // Trent Brown
  "0034351": ["0034351-v3", "Dallas_Goedert_(52510560186)_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Dallas Goedert
  "0034974": ["0034974-v3", "card:6e82f20b", "", "", "", 2025], // Julian Love
  "0036223": ["0036223-v3", "card:2c36ebe3", "", "", "", 2025], // Jonathan Taylor
  "0036900": ["0036900-v3", "Commanders_vs._Bengals_-_54752531474.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Ja'Marr Chase
  "0037238": ["0037238-v3", "card:8018af69", "", "", "", 2025], // Drake London
  "0037244": ["0037244-v3", "card:e854fbfe", "", "", "", 2022], // Devin Lloyd
  "0039851": ["0039851-v3", "card:e1190579", "", "", "", 2025], // Drake Maye
  "0033288": ["0033288-v4", "49ers_at_Redskins_2019,_George_Kittle_(48933294286).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2019], // George Kittle
  "0034815": ["0034815-v3", "Fred_Warner_49ers_2018_(cropped).jpg", "U.S. Air Force Airman 1st Class Jonathon D. A. Carnell", "Public domain", "", 2018], // Fred Warner
  "0035248": ["0035248-v3", "card:8591528f", "", "", "", 2024], // Zach Allen
  "0036409": ["0036409-v3", "card:7114bad2", "", "", "", 2025], // Jordyn Brooks
  "0037192": ["0037192-v3", "card:cbb67e9a", "", "", "", 2025], // George Karlaftis
  "0038552": ["0038552-v3", "card:622671c6", "", "", "", 2025], // Riley Moss
  "0039064": ["0039064-v3", "card:482c966e", "", "", "", 2025], // Zay Flowers
  "0032378": ["0032378-v3", "card:71dbf72f", "", "", "", 2025], // DeForest Buckner
  "0037239": ["0037239-v3", "card:3e6d8781", "", "", "", 2025], // Chris Olave
  "0038124": ["0038124-v3", "card:d0755ba9", "", "", "", 2025], // Christian Watson
  "0038386": ["0038386-v3", "Jalen_Carter.png", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2023], // Jalen Carter
  "0039404": ["0039404-v3", "card:f3163f69", "", "", "", 2024], // Will Reichard
  "0039840": ["0039840-v3", "card:d1ed13fb", "", "", "", 2024], // Austin Booker
  "0031933": ["0031933-v3", "card:edec21ec", "", "", "", 2025], // Leonard Williams
  "0032965": ["0032965-v3", "card:005af885", "", "", "", 2016], // Ronnie Stanley
  "0035642": ["0035642-v3", "Commanders_vs._Jaguars_(52377888202).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Josh Hines-Allen
  "0036410": ["0036410-v3", "Commanders_vs._Bengals_-_54752649825.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tee Higgins
  "0036914": ["0036914-v3", "card:2f56d602", "", "", "", 2025], // Greg Rousseau
  "0037740": ["0037740-v3", "card:22c9ed76", "", "", "", 2025], // Garrett Wilson
  "0037840": ["0037840-v3", "card:a24b3e85", "", "", "", 2025], // Kyren Williams
  "0039065": ["0039065-v3", "card:0f8f2eed", "", "", "", 2025], // Sam LaPorta
  "0039111": ["0039111-v3", "Tuli_Tuipulotu.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tuli Tuipulotu
  "0039337": ["0039337-v3", "card:04df23b6", "", "", "", 2025], // Malik Nabers
  "0040124": ["0040124-v3", "card:d8dee6c4", "", "", "", 2025], // Tetairoa McMillan
  "0040148": ["0040148-v3", "card:a8affd2c", "", "", "", 2025], // Xavier Watts
  "0041509": ["0041509-v3", "card:363a9aef", "", "", "", 2026], // Arvell Reese
  "0031492": ["0031492-v3", "Jason_Myers_-_51720303739_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Jason Myers
  "0033106": ["0033106-v4", "Jared_Goff_2022.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Jared Goff
  "0033831": ["0033831-v3", "card:db6e7b1d", "", "", "", 2023], // Andrew Wylie
  "0035272": ["0035272-v3", "card:2aa4bc7a", "", "", "", 2025], // Andrew Van Ginkel
  "0036388": ["0036388-v3", "card:8f1ef04d", "", "", "", 2025], // Xavier McKinney
  "0036554": ["0036554-v3", "card:a77c3b07", "", "", "", 2025], // Nico Collins
  "0036986": ["0036986-v3", "card:43715dbb", "", "", "", 2021], // Nahshon Wright
  "0036997": ["0036997-v3", "card:ebe3a750", "", "", "", 2025], // Javonte Williams
  "0038038": ["0038038-v3", "card:ef680e7b", "", "", "", 2025], // Kyle Hamilton
  "0039018": ["0039018-v3", "card:55ff57af", "", "", "", 2024], // Jack Campbell
  "0040128": ["0040128-v3", "card:ec900f0b", "", "", "", 2025], // Tyler Warren
  "0032764": ["0032764-v3", "card:6d82e0b7", "", "", "", 2025], // Derrick Henry
  "0034158": ["0034158-v3", "card:4f58855c", "", "", "", 2025], // Brian O'Neill
  "0035236": ["0035236-v3", "card:ea42c304", "", "", "", 2025], // Byron Murphy
  "0035358": ["0035358-v3", "card:474c3657", "", "", "", 2025], // Chase McLaughlin
  "0035647": ["0035647-v3", "card:a692a885", "", "", "", 2025], // Montez Sweat
  "0036418": ["0036418-v3", "card:37d7a6ae", "", "", "", 2025], // Zack Baun
  "0036442": ["0036442-v3", "Commanders_vs._Bengals_-_54751463192.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Joe Burrow
  "0036912": ["0036912-v3", "Devonta_Smith_2022_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // DeVonta Smith
  "0037240": ["0037240-v3", "card:0d38f2da", "", "", "", 2025], // Jameson Williams
  "0038996": ["0038996-v3", "2025_Commanders_at_Packers_77.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tucker Kraft
  "0039141": ["0039141-v3", "card:6ccaff04", "", "", "", 2023], // Brian Branch
  "0039340": ["0039340-v3", "card:2884fc63", "", "", "", 2024], // Laiatu Latu
  "0039852": ["0039852-v3", "card:4f7d7d32", "", "", "", 2025], // Jared Verse
  "0039888": ["0039888-v3", "card:c0c4fd4c", "", "", "", 2025], // Quinyon Mitchell
  "0040122": ["0040122-v3", "2025_Raiders_at_Commanders_106.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Ashton Jeanty
  "0033131": ["0033131-v3", "Maliek_Collins.jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2017], // Maliek Collins
  "0034342": ["0034342-v3", "card:39210d3c", "", "", "", 2024], // Quenton Nelson
  "0036220": ["0036220-v3", "card:4358aa6a", "", "", "", 2022], // Derrick Brown
  "0037692": ["0037692-v3", "Brandon_Aubrey_10_1_2023.jpg", "Time2Football", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2023], // Brandon Aubrey
  "0038134": ["0038134-v3", "card:ef3f7016", "", "", "", 2025], // Kenneth Walker III
  "0039838": ["0039838-v3", "card:9c0c4140", "", "", "", 2024], // Calen Bullock
  "0039860": ["0039860-v3", "card:32634834", "", "", "", 2024], // Kool-Aid McKinstry
  "0030506": ["0030506-v3", "card:91bc668d", "", "", "", 2025], // Travis Kelce
  "0031364": ["0031364-v3", "card:4df47511", "", "", "", 2019], // Jadeveon Clowney
  "0031898": ["0031898-v3", "card:b40f5b0c", "", "", "", 2024], // Alex Singleton
  "0034429": ["0034429-v3", "card:33521d8b", "", "", "", 2025], // Jordan Mailata
  "0034495": ["0034495-v3", "card:1845e325", "", "", "", 2025], // Evan Brown
  "0034668": ["0034668-v3", "card:652f9351", "", "", "", 2021], // Aaron Stinnie
  "0034675": ["0034675-v3", "card:143c21d6", "", "", "", 2021], // Jessie Bates
  "0034752": ["0034752-v3", "card:3dc1fbf9", "", "", "", 2018], // Orlando Brown
  "0034759": ["0034759-v3", "Kolton_Miller_2025.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Kolton Miller
  "0034856": ["0034856-v4", "Denzel_Ward_(43775487861).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Denzel Ward
  "0035230": ["0035230-v3", "card:e0ed6773", "", "", "", 2024], // Ed Oliver
  "0035261": ["0035261-v3", "card:6069d76c", "", "", "", 2025], // Tony Pollard
  "0035687": ["0035687-v3", "card:5f794291", "", "", "", 2024], // Bobby Okereke
  "0036971": ["0036971-v3", "Trevor_Lawrence_vs_Commanders_2022_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Trevor Lawrence
  "0036974": ["0036974-v3", "card:aa81a98a", "", "", "", 2023], // Tyson Campbell
  "0037228": ["0037228-v3", "card:644c7b7d", "", "", "", 2025], // Jaylen Warren
  "0037250": ["0037250-v4", "2022_Cleveland_Browns_Training_Camp_(52339586867).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2022], // Martin Emerson
  "0037838": ["0037838-v3", "card:cdf271ac", "", "", "", 2025], // Isaiah Likely
  "0038563": ["0038563-v3", "Tre_Tucker_(54841331175)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tre Tucker
  "0039067": ["0039067-v3", "Rashee_Rice_(55090108907)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2026], // Rashee Rice
  "0039137": ["0039137-v3", "card:8c752b19", "", "", "", 2024], // Byron Young
  "0039309": ["0039309-v3", "card:a0107403", "", "", "", 2024], // Byron Murphy II
  "0039371": ["0039371-v3", "card:246c5662", "", "", "", 2024], // Kris Abrams-Draine
  "0039491": ["0039491-v3", "card:65217e78", "", "", "", 2025], // Jalen Coker
  "0040579": ["0040579-v3", "Carson_Schwesinger_2025_Browns_Camp_(cropped).jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2025], // Carson Schwesinger
  "0041528": ["0041528-v3", "card:97e9381e", "", "", "", 2025], // Michael Taaffe
  "0032762": ["0032762-v3", "Chris_Jones_(defensive_tackle,_born_1994).JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2017], // Chris Jones
  "0033890": ["0033890-v3", "Budda_Baker.JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2017], // Budda Baker
  "0034768": ["0034768-v3", "Chukwuma_Okorafor_(50695534763)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Chukwuma Okorafor
  "0034790": ["0034790-v3", "card:5892f223", "", "", "", 2019], // Derwin James
  "0034836": ["0034836-v3", "Braden_Smith_at_Lambeau_Field.jpg", "Jhansen23", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2024], // Braden Smith
  "0035676": ["0035676-v3", "card:919d0a36", "", "", "", 2025], // A.J. Brown
  "0036322": ["0036322-v3", "Jefferson_2022.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Justin Jefferson
  "0036500": ["0036500-v3", "card:e203925b", "", "", "", 2025], // Jamien Sherwood
  "0036624": ["0036624-v3", "card:5ce83c72", "", "", "", 2021], // Alim McNeill
  "0039172": ["0039172-v3", "card:26614a6e", "", "", "", 2025], // Jake Bates
  "0039918": ["0039918-v3", "Commanders_vs._Bears_(54857809842).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Caleb Williams
  "0040663": ["0040663-v3", "Harold_Fannin_Jr._2026_Cleveland_Browns_training_camp_(cropped).jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Harold Fannin Jr.
  "0033873": ["0033873-v3", "card:6e94ee7f", "", "", "", 2020], // Patrick Mahomes
  "0034796": ["0034796-v3", "Lamar_Jackson_passing_2020_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Lamar Jackson
  "0039163": ["0039163-v3", "card:4d2beeca", "", "", "", 2024], // C.J. Stroud
  "0023459": ["0023459-v3", "AaronRodgersSteelers_(cropped).jpg", "Cramerwiki", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", 2025], // Aaron Rodgers
};
// </action-photos>

/** A player's action photo, cut out (p: his key), '' for none. */
export const actionUrl = p => (ACTION[p] ? `img/dynasty/action/${ACTION[p][0]}.webp` : '');
/** Its source: {card (his real card, core/dynasty-real.js)} for a trading card's photo, else {author, licence, licenceUrl,
 *  page (its Wikimedia Commons page), year}; null for none. */
export function actionCredit(p) {
  const r = ACTION[p];
  if (!r) return null;
  if (r[1].startsWith('card:')) {
    const card = (REAL[p] || []).find(e => e[0] === r[1].slice(5));
    return card ? {card} : null;
  }
  if (r[1].startsWith('flickr:')) {
    // (a Flickr photo, 'flickr:<owner>/<photo id>': its page on Flickr)
    return {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://www.flickr.com/photos/${r[1].slice(7)}`, site: 'Flickr', year: r[5] || 0};
  }
  return {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r[1])}`, site: 'Wikimedia Commons', year: r[5] || 0};
}
