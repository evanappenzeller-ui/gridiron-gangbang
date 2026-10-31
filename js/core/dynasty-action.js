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
  "xjerryrice": ["xjerryrice-v2", "card:dce40a6e", "", "", "", 2024], // Jerry Rice
  "xlawrencetaylor": ["xlawrencetaylor-v2", "card:4f9bbace", "", "", "", 2025], // Lawrence Taylor
  "xtombrady": ["xtombrady-v2", "card:53a447c4", "", "", "", 2022], // Tom Brady
  "xbarrysanders": ["xbarrysanders-v2", "card:87e3f8ab", "", "", "", 2025], // Barry Sanders
  "xjimbrown": ["xjimbrown-v2", "card:f4a7b560", "", "", "", 2017], // Jim Brown
  "xpeytonmanning": ["xpeytonmanning-v2", "card:3d1c7df6", "", "", "", 2022], // Peyton Manning
  "xreggiewhite": ["xreggiewhite-v2", "card:db155bd6", "", "", "", 2020], // Reggie White
  "xaarondonald": ["xaarondonald-v2", "Aaron_Donald_2020_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Aaron Donald
  "xdeionsanders": ["xdeionsanders-v2", "card:6ae921b6", "", "", "", 2025], // Deion Sanders
  "xjoemontana": ["xjoemontana-v2", "1986_Jeno's_Pizza_-_28_-_Roger_Craig_(Joe_Montana_crop).jpg", "Jeno's", "Public domain", "", 1985], // Joe Montana
  "xjohnnyunitas": ["xjohnnyunitas-v2", "1958_topps_johnny_unitas.jpg", "Unknown author Unknown author", "Public domain", "", 1958], // Johnny Unitas
  "xrandymoss": ["xrandymoss-v2", "card:15602fe2", "", "", "", 2022], // Randy Moss
  "xraylewis": ["xraylewis-v2", "Ray-Lewis-2008-Steelers-regseason-game.jpg", "Andy from Pittsburgh, Pennsylvania. Cropped by User:Blueag9 .", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // Ray Lewis
  "xwalterpayton": ["xwalterpayton-v2", "card:f4d8c841", "", "", "", 2024], // Walter Payton
  "xcalvinjohnson": ["xcalvinjohnson-v2", "card:c75efa30", "", "", "", 2025], // Calvin Johnson
  "xdickbutkus": ["xdickbutkus-v2", "card:e54c3f74", "", "", "", 2024], // Dick Butkus
  "xedreed": ["xedreed-v2", "card:4855b7b3", "", "", "", 2025], // Ed Reed
  "xgalesayers": ["xgalesayers-v2", "Gale_sayers_playing.jpg", "Unknown", "Public domain", "", 1972], // Gale Sayers
  "xladainiantomli": ["xladainiantomli-v2", "card:85239958", "", "", "", 2020], // LaDainian Tomlinson
  "xrobgronkowski": ["xrobgronkowski-v2", "card:9953c1e3", "", "", "", 2024], // Rob Gronkowski
  "xronnielott": ["xronnielott-v2", "card:30e32c01", "", "", "", 2023], // Ronnie Lott
  "xadamvinatieri": ["xadamvinatieri-v2", "card:209f8fd8", "", "", "", 2024], // Adam Vinatieri
  "xboblilly": ["xboblilly-v2", "card:c11a8570", "", "", "", 2024], // Bob Lilly
  "xbrettfavre": ["xbrettfavre-v2", "19981213_36_Brett_Favre,_Lambeau_Field_Cropped.jpg", "David Wilson", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 1998], // Brett Favre
  "xbrucesmith": ["xbrucesmith-v2", "card:0a7525d1", "", "", "", 2024], // Bruce Smith
  "xdarrellerevis": ["xdarrellerevis-v2", "card:00bb5024", "", "", "", 2024], // Darrelle Revis
  "xdrewbrees": ["xdrewbrees-v2", "card:db16130a", "", "", "", 2025], // Drew Brees
  "xemmittsmith": ["xemmittsmith-v2", "card:96ea8a13", "", "", "", 2025], // Emmitt Smith
  "xericdickerson": ["xericdickerson-v2", "card:de4288c4", "", "", "", 2025], // Eric Dickerson
  "xjacklambert": ["xjacklambert-v2", "Jack_Lambert_in_December_1975.JPG", "Malcolm Emmons", "Public domain", "", 1975], // Jack Lambert
  "xjjwatt": ["xjjwatt-v2", "card:2b885e2c", "", "", "", 2024], // J.J. Watt
  "xjohnelway": ["xjohnelway-v2", "card:13e21bf9", "", "", "", 2025], // John Elway
  "xjohnhannah": ["xjohnhannah-v2", "card:698a1909", "", "", "", 2024], // John Hannah
  "xjonathanogden": ["xjonathanogden-v2", "card:122abf8f", "", "", "", 2024], // Jonathan Ogden
  "xlancealworth": ["xlancealworth-v2", "card:30eda0df", "", "", "", 2020], // Lance Alworth
  "xlarryallen": ["xlarryallen-v2", "card:c303b2ca", "", "", "", 2024], // Larry Allen
  "xrogerstaubach": ["xrogerstaubach-v2", "Staubach_cowboys_qb.jpg", "Unknown author Unknown author", "Public domain", "", 1976], // Roger Staubach
  "xtonygonzalez": ["xtonygonzalez-v2", "card:4d84e5a9", "", "", "", 2022], // Tony Gonzalez
  "xtroypolamalu": ["xtroypolamalu-v2", "card:11426a23", "", "", "", 2024], // Troy Polamalu
  "xadrianpeterson": ["xadrianpeterson-v2", "card:ec0fbcd0", "", "", "", 2021], // Adrian Peterson
  "xbartstarr": ["xbartstarr-v2", "Bart_Starr_1958.jpg", "Vintage Football Card Gallery", "Public domain", "", 1958], // Bart Starr
  "xbrucematthews": ["xbrucematthews-v2", "card:3e95cb09", "", "", "", 2024], // Bruce Matthews
  "xchampbailey": ["xchampbailey-v2", "card:948edcd4", "", "", "", 2024], // Champ Bailey
  "xcharleswoodson": ["xcharleswoodson-v2", "card:42100e96", "", "", "", 2025], // Charles Woodson
  "xdarrellgreen": ["xdarrellgreen-v2", "card:79faa686", "", "", "", 2025], // Darrell Green
  "xfrantarkenton": ["xfrantarkenton-v2", "card:40cb3dd5", "", "", "", 2025], // Fran Tarkenton
  "xginomarchetti": ["xginomarchetti-v2", "Gino_Marchetti_1961.jpg", "Jay Publishing", "Public domain", "", 1961], // Gino Marchetti
  "xjackham": ["xjackham-v2", "JackHamPIT.png", "Unknown author Unknown author", "Public domain", "", 1982], // Jack Ham
  "xjoenamath": ["xjoenamath-v2", "1986_Jeno's_Pizza_-_37_-_Joe_Namath_(Joe_Namath_crop).jpg", "Jeno's", "Public domain", "", 1969], // Joe Namath
  "xjuniorseau": ["xjuniorseau-v2", "card:b24dc757", "", "", "", 2000], // Junior Seau
  "xmarshallfaulk": ["xmarshallfaulk-v2", "card:a198ec8a", "", "", "", 2025], // Marshall Faulk
  "xmarvinharrison": ["xmarvinharrison-v2", "card:8c014c91", "", "", "", 2000], // Marvin Harrison
  "xmikesingletary": ["xmikesingletary-v2", "card:991e2b27", "", "", "", 2025], // Mike Singletary
  "xraynitschke": ["xraynitschke-v2", "card:90c319b1", "", "", "", 2002], // Ray Nitschke
  "xrodwoodson": ["xrodwoodson-v2", "card:74383d63", "", "", "", 2024], // Rod Woodson
  "xterrellowens": ["xterrellowens-v2", "card:e0c6dd8a", "", "", "", 2025], // Terrell Owens
  "xwalterjones": ["xwalterjones-v2", "card:df20b7f7", "", "", "", 2022], // Walter Jones
  "xbriandawkins": ["xbriandawkins-v2", "Brian_Dawkins.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2009], // Brian Dawkins
  "xcriscarter": ["xcriscarter-v2", "card:a307aca8", "", "", "", 2024], // Cris Carter
  "xdanfouts": ["xdanfouts-v2", "card:3a1ad234", "", "", "", 2024], // Dan Fouts
  "xfrancoharris": ["xfrancoharris-v2", "card:72f52514", "", "", "", 2018], // Franco Harris
  "xhowielong": ["xhowielong-v2", "card:5a7121ca", "", "", "", 2025], // Howie Long
  "xjimkelly": ["xjimkelly-v2", "card:0fd0b22d", "", "", "", 2025], // Jim Kelly
  "xjustintucker": ["xjustintucker-v2", "card:7facf3ee", "", "", "", 2024], // Justin Tucker
  "xkellenwinslow": ["xkellenwinslow-v2", "card:cb5223cc", "", "", "", 2025], // Kellen Winslow
  "xkurtwarner": ["xkurtwarner-v2", "card:93e8be8d", "", "", "", 2025], // Kurt Warner
  "xmarcusallen": ["xmarcusallen-v2", "1985_Police_Raiders-Rams_-_01_Marcus_Allen_(crop).jpg", "KIIS Radio/Los Angeles Raiders/Los Angeles County Sheriff's Department", "Public domain", "", 1984], // Marcus Allen
  "xpaulwarfield": ["xpaulwarfield-v2", "card:d8279589", "", "", "", 2025], // Paul Warfield
  "xrandywhite": ["xrandywhite-v2", "card:4f7abc50", "", "", "", 2025], // Randy White
  "xshannonsharpe": ["xshannonsharpe-v2", "card:e822db1d", "", "", "", 2000], // Shannon Sharpe
  "xterrybradshaw": ["xterrybradshaw-v2", "card:3faf242a", "", "", "", 2025], // Terry Bradshaw
  "xtonydorsett": ["xtonydorsett-v2", "card:ce1bc138", "", "", "", 2025], // Tony Dorsett
  "xwarrensapp": ["xwarrensapp-v2", "card:83ff64af", "", "", "", 2024], // Warren Sapp
  "xwillielanier": ["xwillielanier-v2", "card:d7b25bcc", "", "", "", 2020], // Willie Lanier
  "xcurtismartin": ["xcurtismartin-v2", "card:97ebaee1", "", "", "", 2022], // Curtis Martin
  "xjackyoungblood": ["xjackyoungblood-v2", "card:899af938", "", "", "", 2022], // Jack Youngblood
  "xjohnrandle": ["xjohnrandle-v2", "card:c3a2fd8c", "", "", "", 2024], // John Randle
  "xlembarney": ["xlembarney-v2", "LemBarneyDET.png", "Unknown author Unknown author", "Public domain", "", 1968], // Lem Barney
  "xlendawson": ["xlendawson-v2", "Kansas_City_Chiefs_at_Denver_Broncos_1985-12-14_(ticket)_(crop).jpg", "Denver Broncos/Unlimited Printing & Systems, Inc.", "Public domain", "", 1970], // Len Dawson
  "xlennymoore": ["xlennymoore-v2", "card:4e5570dc", "", "", "", 2024], // Lenny Moore
  "xozzienewsome": ["xozzienewsome-v2", "card:b1de77e3", "", "", "", 2025], // Ozzie Newsome
  "xpaulkrause": ["xpaulkrause-v2", "card:36f47773", "", "", "", 2024], // Paul Krause
  "xsamhuff": ["xsamhuff-v2", "card:b4147426", "", "", "", 2007], // Sam Huff
  "xtedhendricks": ["xtedhendricks-v2", "card:a96a3844", "", "", "", 2020], // Ted Hendricks
  "xwarrenmoon": ["xwarrenmoon-v2", "card:a1aa68a4", "", "", "", 2025], // Warren Moon
  "xartmonk": ["xartmonk-v2", "card:665c0883", "", "", "", 2025], // Art Monk
  "xjohnriggins": ["xjohnriggins-v2", "card:e4cafdfb", "", "", "", 2024], // John Riggins
  "xsteveatwater": ["xsteveatwater-v2", "card:5374a50e", "", "", "", 2024], // Steve Atwater
  "0032726": ["0032726-v2", "card:fdb4b05b", "", "", "", 2024], // Ka'imi Fairbairn
  "0034857": ["0034857-v2", "card:4d5fa48e", "", "", "", 2025], // Josh Allen
  "0037236": ["0037236-v2", "Aidan_Hutchinson.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Aidan Hutchinson
  "0037744": ["0037744-v2", "card:9b217822", "", "", "", 2025], // Trey McBride
  "0038543": ["0038543-v2", "card:bbd87f01", "", "", "", 2025], // Jaxon Smith-Njigba
  "0039139": ["0039139-v2", "card:e2026c5e", "", "", "", 2025], // Jahmyr Gibbs
  "0039343": ["0039343-v2", "card:9207fa61", "", "", "", 2024], // Kamari Lassiter
  "0029592": ["0029592-v2", "card:12a53429", "", "", "", 2012], // Kevin Zeitler
  "0034973": ["0034973-v2", "card:3fcfb46e", "", "", "", 2025], // Maxx Crosby
  "0033886": ["0033886-v2", "card:9a3a79ff", "", "", "", 2025], // T.J. Watt
  "0035643": ["0035643-v2", "card:ab489ef6", "", "", "", 2025], // Jeffery Simmons
  "0035699": ["0035699-v2", "card:8a07c251", "", "", "", 2019], // Jamel Dean
  "0038560": ["0038560-v2", "card:9ec9e416", "", "", "", 2023], // Jordan Battle
  "0039075": ["0039075-v2", "card:b0fcd71b", "", "", "", 2025], // Puka Nacua
  "0033280": ["0033280-v2", "card:e4e54d0a", "", "", "", 2025], // Christian McCaffrey
  "0036963": ["0036963-v2", "card:85d5b9a5", "", "", "", 2025], // Amon-Ra St. Brown
  "0036994": ["0036994-v2", "card:7437998c", "", "", "", 2023], // Ernest Jones
  "0039338": ["0039338-v2", "card:7da92708", "", "", "", 2025], // Brock Bowers
  "0026498": ["0026498-v2", "card:db6e878a", "", "", "", 2025], // Matthew Stafford
  "0031565": ["0031565-v2", "card:6a5c936e", "", "", "", 2025], // Danielle Hunter
  "0037248": ["0037248-v2", "card:53cee6fd", "", "", "", 2025], // James Cook
  "0037834": ["0037834-v2", "card:7fb70609", "", "", "", 2025], // Brock Purdy
  "0039108": ["0039108-v2", "card:e7b77dc0", "", "", "", 2025], // Will Anderson Jr.
  "0031279": ["0031279-v2", "card:16942cf7", "", "", "", 2024], // Jake Matthews
  "0033132": ["0033132-v2", "card:0ad80e50", "", "", "", 2023], // Kevin Byard
  "0036358": ["0036358-v2", "card:92ce9753", "", "", "", 2025], // CeeDee Lamb
  "0036564": ["0036564-v2", "card:889a4391", "", "", "", 2024], // Talanoa Hufanga
  "0038542": ["0038542-v2", "card:6d14e83b", "", "", "", 2025], // Bijan Robinson
  "0039841": ["0039841-v2", "card:af1d70e6", "", "", "", 2025], // Cooper DeJean
  "0032071": ["0032071-v2", "card:7fc98f76", "", "", "", 2020], // Trent Brown
  "0034351": ["0034351-v2", "card:6267cb27", "", "", "", 2025], // Dallas Goedert
  "0034974": ["0034974-v2", "card:6e82f20b", "", "", "", 2025], // Julian Love
  "0036223": ["0036223-v2", "card:2c36ebe3", "", "", "", 2025], // Jonathan Taylor
  "0036900": ["0036900-v2", "card:baa7db95", "", "", "", 2024], // Ja'Marr Chase
  "0037238": ["0037238-v2", "card:8018af69", "", "", "", 2025], // Drake London
  "0037244": ["0037244-v2", "card:e854fbfe", "", "", "", 2022], // Devin Lloyd
  "0039851": ["0039851-v2", "card:e1190579", "", "", "", 2025], // Drake Maye
  "0033288": ["0033288-v2", "card:92d1ad35", "", "", "", 2025], // George Kittle
  "0034815": ["0034815-v2", "Fred_Warner_49ers_2018_(cropped).jpg", "U.S. Air Force Airman 1st Class Jonathon D. A. Carnell", "Public domain", "", 2018], // Fred Warner
  "0035248": ["0035248-v2", "card:8591528f", "", "", "", 2024], // Zach Allen
  "0036409": ["0036409-v2", "card:7114bad2", "", "", "", 2025], // Jordyn Brooks
  "0037192": ["0037192-v2", "card:cbb67e9a", "", "", "", 2025], // George Karlaftis
  "0038552": ["0038552-v2", "card:622671c6", "", "", "", 2025], // Riley Moss
  "0039064": ["0039064-v2", "card:482c966e", "", "", "", 2025], // Zay Flowers
  "0032378": ["0032378-v2", "card:71dbf72f", "", "", "", 2025], // DeForest Buckner
  "0037239": ["0037239-v2", "card:3e6d8781", "", "", "", 2025], // Chris Olave
  "0038124": ["0038124-v2", "card:d0755ba9", "", "", "", 2025], // Christian Watson
  "0038386": ["0038386-v2", "Jalen_Carter.png", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2023], // Jalen Carter
  "0039404": ["0039404-v2", "card:f3163f69", "", "", "", 2024], // Will Reichard
  "0039840": ["0039840-v2", "card:d1ed13fb", "", "", "", 2024], // Austin Booker
  "0031933": ["0031933-v2", "card:edec21ec", "", "", "", 2025], // Leonard Williams
  "0032965": ["0032965-v2", "card:005af885", "", "", "", 2016], // Ronnie Stanley
  "0035642": ["0035642-v2", "card:c9f10e80", "", "", "", 2025], // Josh Hines-Allen
  "0036410": ["0036410-v2", "card:0e77b0cd", "", "", "", 2025], // Tee Higgins
  "0036914": ["0036914-v2", "card:2f56d602", "", "", "", 2025], // Greg Rousseau
  "0037740": ["0037740-v2", "card:22c9ed76", "", "", "", 2025], // Garrett Wilson
  "0037840": ["0037840-v2", "card:a24b3e85", "", "", "", 2025], // Kyren Williams
  "0039065": ["0039065-v2", "card:0f8f2eed", "", "", "", 2025], // Sam LaPorta
  "0039111": ["0039111-v2", "card:056da6da", "", "", "", 2023], // Tuli Tuipulotu
  "0039337": ["0039337-v2", "card:04df23b6", "", "", "", 2025], // Malik Nabers
  "0040124": ["0040124-v2", "card:d8dee6c4", "", "", "", 2025], // Tetairoa McMillan
  "0040148": ["0040148-v2", "card:a8affd2c", "", "", "", 2025], // Xavier Watts
  "0041509": ["0041509-v2", "card:363a9aef", "", "", "", 2026], // Arvell Reese
  "0031492": ["0031492-v2", "card:010f10bb", "", "", "", 2025], // Jason Myers
  "0033106": ["0033106-v2", "card:f2ba69cb", "", "", "", 2025], // Jared Goff
  "0033831": ["0033831-v2", "card:db6e7b1d", "", "", "", 2023], // Andrew Wylie
  "0035272": ["0035272-v2", "card:2aa4bc7a", "", "", "", 2025], // Andrew Van Ginkel
  "0036388": ["0036388-v2", "card:8f1ef04d", "", "", "", 2025], // Xavier McKinney
  "0036554": ["0036554-v2", "card:a77c3b07", "", "", "", 2025], // Nico Collins
  "0036986": ["0036986-v2", "card:43715dbb", "", "", "", 2021], // Nahshon Wright
  "0036997": ["0036997-v2", "card:ebe3a750", "", "", "", 2025], // Javonte Williams
  "0038038": ["0038038-v2", "card:ef680e7b", "", "", "", 2025], // Kyle Hamilton
  "0039018": ["0039018-v2", "card:55ff57af", "", "", "", 2024], // Jack Campbell
  "0040128": ["0040128-v2", "card:ec900f0b", "", "", "", 2025], // Tyler Warren
  "0032764": ["0032764-v2", "card:6d82e0b7", "", "", "", 2025], // Derrick Henry
  "0034158": ["0034158-v2", "card:4f58855c", "", "", "", 2025], // Brian O'Neill
  "0035236": ["0035236-v2", "card:ea42c304", "", "", "", 2025], // Byron Murphy
  "0035358": ["0035358-v2", "card:474c3657", "", "", "", 2025], // Chase McLaughlin
  "0035647": ["0035647-v2", "card:a692a885", "", "", "", 2025], // Montez Sweat
  "0036418": ["0036418-v2", "card:37d7a6ae", "", "", "", 2025], // Zack Baun
  "0036442": ["0036442-v2", "card:a046a50b", "", "", "", 2025], // Joe Burrow
  "0036912": ["0036912-v2", "card:6f8daaf3", "", "", "", 2025], // DeVonta Smith
  "0037240": ["0037240-v2", "card:0d38f2da", "", "", "", 2025], // Jameson Williams
  "0038996": ["0038996-v2", "card:fcc421e8", "", "", "", 2025], // Tucker Kraft
  "0039141": ["0039141-v2", "card:6ccaff04", "", "", "", 2023], // Brian Branch
  "0039340": ["0039340-v2", "card:2884fc63", "", "", "", 2024], // Laiatu Latu
  "0039852": ["0039852-v2", "card:4f7d7d32", "", "", "", 2025], // Jared Verse
  "0039888": ["0039888-v2", "card:c0c4fd4c", "", "", "", 2025], // Quinyon Mitchell
  "0040122": ["0040122-v2", "card:b7c2f791", "", "", "", 2025], // Ashton Jeanty
  "0033131": ["0033131-v2", "Maliek_Collins.jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2017], // Maliek Collins
  "0034342": ["0034342-v2", "card:39210d3c", "", "", "", 2024], // Quenton Nelson
  "0036220": ["0036220-v2", "card:4358aa6a", "", "", "", 2022], // Derrick Brown
  "0037692": ["0037692-v2", "card:740b1cc4", "", "", "", 2025], // Brandon Aubrey
  "0038134": ["0038134-v2", "card:ef3f7016", "", "", "", 2025], // Kenneth Walker III
  "0039838": ["0039838-v2", "card:9c0c4140", "", "", "", 2024], // Calen Bullock
  "0039860": ["0039860-v2", "card:32634834", "", "", "", 2024], // Kool-Aid McKinstry
  "0030506": ["0030506-v2", "card:91bc668d", "", "", "", 2025], // Travis Kelce
  "0031364": ["0031364-v2", "card:4df47511", "", "", "", 2019], // Jadeveon Clowney
  "0031898": ["0031898-v2", "card:b40f5b0c", "", "", "", 2024], // Alex Singleton
  "0034429": ["0034429-v2", "card:33521d8b", "", "", "", 2025], // Jordan Mailata
  "0034495": ["0034495-v2", "card:1845e325", "", "", "", 2025], // Evan Brown
  "0034668": ["0034668-v2", "card:652f9351", "", "", "", 2021], // Aaron Stinnie
  "0034675": ["0034675-v2", "card:143c21d6", "", "", "", 2021], // Jessie Bates
  "0034752": ["0034752-v2", "card:3dc1fbf9", "", "", "", 2018], // Orlando Brown
  "0034759": ["0034759-v2", "Kolton_Miller_2025.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Kolton Miller
  "0034856": ["0034856-v2", "Denzel_Ward_(cropped).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Denzel Ward
  "0035230": ["0035230-v2", "card:e0ed6773", "", "", "", 2024], // Ed Oliver
  "0035261": ["0035261-v2", "card:6069d76c", "", "", "", 2025], // Tony Pollard
  "0035687": ["0035687-v2", "card:5f794291", "", "", "", 2024], // Bobby Okereke
  "0036971": ["0036971-v2", "card:38cf1151", "", "", "", 2025], // Trevor Lawrence
  "0036974": ["0036974-v2", "card:aa81a98a", "", "", "", 2023], // Tyson Campbell
  "0037228": ["0037228-v2", "card:644c7b7d", "", "", "", 2025], // Jaylen Warren
  "0037250": ["0037250-v2", "card:15584938", "", "", "", 2022], // Martin Emerson
  "0037838": ["0037838-v2", "card:cdf271ac", "", "", "", 2025], // Isaiah Likely
  "0038563": ["0038563-v2", "card:9351039a", "", "", "", 2025], // Tre Tucker
  "0039067": ["0039067-v2", "Rashee_Rice_(55090108907)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2026], // Rashee Rice
  "0039137": ["0039137-v2", "card:8c752b19", "", "", "", 2024], // Byron Young
  "0039309": ["0039309-v2", "card:a0107403", "", "", "", 2024], // Byron Murphy II
  "0039371": ["0039371-v2", "card:246c5662", "", "", "", 2024], // Kris Abrams-Draine
  "0039491": ["0039491-v2", "card:65217e78", "", "", "", 2025], // Jalen Coker
  "0040579": ["0040579-v2", "card:5e8014b1", "", "", "", 2025], // Carson Schwesinger
  "0041528": ["0041528-v2", "card:97e9381e", "", "", "", 2025], // Michael Taaffe
  "0032762": ["0032762-v2", "card:ab624ab1", "", "", "", 2025], // Chris Jones
  "0033890": ["0033890-v2", "card:e938db97", "", "", "", 2025], // Budda Baker
  "0034768": ["0034768-v2", "card:fd0da732", "", "", "", 2018], // Chukwuma Okorafor
  "0034790": ["0034790-v2", "card:5892f223", "", "", "", 2019], // Derwin James
  "0034836": ["0034836-v2", "card:a4a77ff6", "", "", "", 2025], // Braden Smith
  "0035676": ["0035676-v2", "card:919d0a36", "", "", "", 2025], // A.J. Brown
  "0036322": ["0036322-v2", "card:ac5599c6", "", "", "", 2025], // Justin Jefferson
  "0036500": ["0036500-v2", "card:e203925b", "", "", "", 2025], // Jamien Sherwood
  "0036624": ["0036624-v2", "card:5ce83c72", "", "", "", 2021], // Alim McNeill
  "0039172": ["0039172-v2", "card:26614a6e", "", "", "", 2025], // Jake Bates
  "0039918": ["0039918-v2", "card:d1c305c9", "", "", "", 2025], // Caleb Williams
  "0040663": ["0040663-v2", "Harold_Fannin_Jr._2026_Cleveland_Browns_training_camp_(cropped).jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Harold Fannin Jr.
  "0033873": ["0033873-v2", "card:6e94ee7f", "", "", "", 2020], // Patrick Mahomes
  "0034796": ["0034796-v2", "card:6ad26ae1", "", "", "", 2025], // Lamar Jackson
  "0039163": ["0039163-v2", "card:4d2beeca", "", "", "", 2024], // C.J. Stroud
  "0023459": ["0023459-v2", "card:df5d895e", "", "", "", 2025], // Aaron Rodgers
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
  return {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r[1])}`, year: r[5] || 0};
}
