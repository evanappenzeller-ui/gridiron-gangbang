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
  "xjerryrice": ["xjerryrice-v4", "own:xjerryrice.jpg", "", "", "", 0], // Jerry Rice
  "xlawrencetaylor": ["xlawrencetaylor-v4", "own:xlawrencetaylor.jpg", "", "", "", 0], // Lawrence Taylor
  "xtombrady": ["xtombrady-v4", "Tom_Brady_(2).jpg", "Keith Allison", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2009], // Tom Brady
  "xbarrysanders": ["xbarrysanders-v4", "card:87e3f8ab", "", "", "", 2025], // Barry Sanders
  "xjimbrown": ["xjimbrown-v3", "card:f4a7b560", "", "", "", 2017], // Jim Brown
  "xpeytonmanning": ["xpeytonmanning-v4", "flickr:denverjeffrey/5043838891", "Jeffrey Beall", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/", 2010], // Peyton Manning
  "xreggiewhite": ["xreggiewhite-v4", "own:xreggiewhite.jpg", "", "", "", 0], // Reggie White
  "xaarondonald": ["xaarondonald-v4", "Aaron_Donald_2020.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Aaron Donald
  "xdeionsanders": ["xdeionsanders-v3", "card:6ae921b6", "", "", "", 2025], // Deion Sanders
  "xjoemontana": ["xjoemontana-v3", "1986_Jeno's_Pizza_-_28_-_Roger_Craig_(Joe_Montana_crop).jpg", "Jeno's", "Public domain", "", 1985], // Joe Montana
  "xjohnnyunitas": ["xjohnnyunitas-v4", "Unitas-Johnny-1963.jpg", "Unknown author", "Public domain", "", 1963], // Johnny Unitas
  "xrandymoss": ["xrandymoss-v4", "Randy_Moss_with_Vikings.jpg", "Mike Morbeck", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2010], // Randy Moss
  "xraylewis": ["xraylewis-v4", "Ray_Lewis_2007.jpg", "Mr.schultz", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2007], // Ray Lewis
  "xwalterpayton": ["xwalterpayton-v3", "card:f4d8c841", "", "", "", 2024], // Walter Payton
  "xanthonymu\u00f1oz": ["xanthonymunoz-v1", "own:xanthonymuñoz.jpg", "", "", "", 0], // Anthony Muñoz
  "xcalvinjohnson": ["xcalvinjohnson-v4", "Calvin_Johnson_vs_Green_Bay.jpg", "Mike Morbeck", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2012], // Calvin Johnson
  "xdanmarino": ["xdanmarino-v1", "own:xdanmarino.jpg", "", "", "", 0], // Dan Marino
  "xdeaconjones": ["xdeaconjones-v1", "own:xdeaconjones.jpg", "", "", "", 0], // Deacon Jones
  "xdickbutkus": ["xdickbutkus-v4", "own:xdickbutkus.jpg", "", "", "", 0], // Dick Butkus
  "xedreed": ["xedreed-v3", "Ed_reed_ravens2012.jpg", "Maryland National Guard", "Public domain", "", 2012], // Ed Reed
  "xgalesayers": ["xgalesayers-v4", "Gale_sayers_playing.jpg", "Unknown", "Public domain", "", 1972], // Gale Sayers
  "xladainiantomli": ["xladainiantomli-v4", "Tomlinson_warming_up_1.jpg", "Dirk", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // LaDainian Tomlinson
  "xrobgronkowski": ["xrobgronkowski-v4", "own:xrobgronkowski.jpg", "", "", "", 0], // Rob Gronkowski
  "xronnielott": ["xronnielott-v4", "own:xronnielott.jpg", "", "", "", 0], // Ronnie Lott
  "xadamvinatieri": ["xadamvinatieri-v3", "card:209f8fd8", "", "", "", 2024], // Adam Vinatieri
  "xboblilly": ["xboblilly-v4", "own:xboblilly.jpg", "", "", "", 0], // Bob Lilly
  "xbrettfavre": ["xbrettfavre-v4", "David_Martin82_Brett_Favre4-Edit2.jpg", "Paul Cutler", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2007], // Brett Favre
  "xbrucesmith": ["xbrucesmith-v3", "card:0a7525d1", "", "", "", 2024], // Bruce Smith
  "xdarrellerevis": ["xdarrellerevis-v3", "card:00bb5024", "", "", "", 2024], // Darrelle Revis
  "xdicknighttrain": ["xdicknighttrain-v1", "own:xdicknighttrain.jpg", "", "", "", 0], // Dick "Night Train" Lane
  "xdrewbrees": ["xdrewbrees-v3", "New_Orleans_Saints_Quarterback,_Drew_Brees_(23262414434)_(cropped).jpg", "Tammy Anthony Baker from Louisiana", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2013], // Drew Brees
  "xearlcampbell": ["xearlcampbell-v4", "own:xearlcampbell.jpg", "", "", "", 0], // Earl Campbell
  "xemmittsmith": ["xemmittsmith-v3", "card:96ea8a13", "", "", "", 2025], // Emmitt Smith
  "xericdickerson": ["xericdickerson-v4", "1985_Police_Raiders-Rams_-_20_Eric_Dickerson_(crop).jpg", "KIIS Radio/Los Angeles Rams/Los Angeles County Sheriff's Department", "Public domain", "", 1984], // Eric Dickerson
  "xjacklambert": ["xjacklambert-v4", "Jack_Lambert_in_December_1975.JPG", "Malcolm Emmons", "Public domain", "", 1975], // Jack Lambert
  "xjjwatt": ["xjjwatt-v4", "own:xjjwatt.jpg", "", "", "", 0], // J.J. Watt
  "xjohnelway": ["xjohnelway-v4", "own:xjohnelway.png", "", "", "", 0], // John Elway
  "xjohnhannah": ["xjohnhannah-v4", "own:xjohnhannah.jpg", "", "", "", 0], // John Hannah
  "xjonathanogden": ["xjonathanogden-v3", "card:122abf8f", "", "", "", 2024], // Jonathan Ogden
  "xlancealworth": ["xlancealworth-v5", "own:xlancealworth.jpg", "", "", "", 0], // Lance Alworth
  "xlarryallen": ["xlarryallen-v4", "own:xlarryallen.jpg", "", "", "", 0], // Larry Allen
  "xrogerstaubach": ["xrogerstaubach-v3", "Staubach_cowboys_qb.jpg", "Unknown author Unknown author", "Public domain", "", 1976], // Roger Staubach
  "xsteveyoung": ["xsteveyoung-v1", "own:xsteveyoung.jpg", "", "", "", 0], // Steve Young
  "xtonygonzalez": ["xtonygonzalez-v4", "own:xtonygonzalez.jpg", "", "", "", 0], // Tony Gonzalez
  "xtroypolamalu": ["xtroypolamalu-v3", "Troy_Polamalu_2013_(cropped).jpg", "original: Paula Lively derivative: Diddykong1130", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2013], // Troy Polamalu
  "xadrianpeterson": ["xadrianpeterson-v3", "Adrian_Peterson_Vikings.jpg", "Arvee5.0", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2012], // Adrian Peterson
  "xalanpage": ["xalanpage-v1", "own:xalanpage.jpg", "", "", "", 0], // Alan Page
  "xbartstarr": ["xbartstarr-v3", "Bart_Starr_1958.jpg", "Vintage Football Card Gallery", "Public domain", "", 1958], // Bart Starr
  "xbojackson": ["xbojackson-v1", "own:xbojackson.jpg", "", "", "", 0], // Bo Jackson
  "xbrucematthews": ["xbrucematthews-v3", "card:3e95cb09", "", "", "", 2024], // Bruce Matthews
  "xchampbailey": ["xchampbailey-v3", "Champ_Bailey_2010.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2010], // Champ Bailey
  "xcharleswoodson": ["xcharleswoodson-v4", "own:xcharleswoodson.jpg", "", "", "", 0], // Charles Woodson
  "xchuckbednarik": ["xchuckbednarik-v4", "own:xchuckbednarik.webp", "", "", "", 0], // Chuck Bednarik
  "xdarrellgreen": ["xdarrellgreen-v4", "own:xdarrellgreen.jpg", "", "", "", 0], // Darrell Green
  "xderrickthomas": ["xderrickthomas-v1", "own:xderrickthomas.jpg", "", "", "", 0], // Derrick Thomas
  "xfrantarkenton": ["xfrantarkenton-v4", "own:xfrantarkenton.jpg", "", "", "", 0], // Fran Tarkenton
  "xginomarchetti": ["xginomarchetti-v3", "Gino_Marchetti_1961.jpg", "Jay Publishing", "Public domain", "", 1961], // Gino Marchetti
  "xjackham": ["xjackham-v3", "JackHamPIT.png", "Unknown author Unknown author", "Public domain", "", 1982], // Jack Ham
  "xjimparker": ["xjimparker-v1", "own:xjimparker.jpg", "", "", "", 0], // Jim Parker
  "xjoenamath": ["xjoenamath-v3", "1986_Jeno's_Pizza_-_37_-_Joe_Namath_(Joe_Namath_crop).jpg", "Jeno's", "Public domain", "", 1969], // Joe Namath
  "xjoethomas": ["xjoethomas-v3", "Joe_Thomas_Cleveland_Browns.jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2011], // Joe Thomas
  "xjuniorseau": ["xjuniorseau-v4", "own:xjuniorseau.jpg", "", "", "", 0], // Junior Seau
  "xmarshallfaulk": ["xmarshallfaulk-v4", "own:xmarshallfaulk.jpg", "", "", "", 0], // Marshall Faulk
  "xmarvinharrison": ["xmarvinharrison-v3", "Marvin_Harrison_in_2007_Training_Camp_2.jpg", "The original uploader was Djmunden at English Wikipedia .", "CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5", 2008], // Marvin Harrison
  "xmelblount": ["xmelblount-v4", "own:xmelblount.jpg", "", "", "", 0], // Mel Blount
  "xmerlinolsen": ["xmerlinolsen-v1", "own:xmerlinolsen.jpg", "", "", "", 0], // Merlin Olsen
  "xmichaelstrahan": ["xmichaelstrahan-v1", "own:xmichaelstrahan.jpg", "", "", "", 0], // Michael Strahan
  "xmikesingletary": ["xmikesingletary-v3", "card:991e2b27", "", "", "", 2025], // Mike Singletary
  "xmikewebster": ["xmikewebster-v1", "own:xmikewebster.jpg", "", "", "", 0], // Mike Webster
  "xraymondberry": ["xraymondberry-v4", "own:xraymondberry.webp", "", "", "", 0], // Raymond Berry
  "xraynitschke": ["xraynitschke-v4", "own:xraynitschke.jpg", "", "", "", 0], // Ray Nitschke
  "xrodwoodson": ["xrodwoodson-v4", "own:xrodwoodson.webp", "", "", "", 0], // Rod Woodson
  "xstevelargent": ["xstevelargent-v1", "own:xstevelargent.webp", "", "", "", 0], // Steve Largent
  "xterrellowens": ["xterrellowens-v4", "own:xterrellowens.jpg", "", "", "", 0], // Terrell Owens
  "xwalterjones": ["xwalterjones-v5", "own:xwalterjones.jpg", "", "", "", 0], // Walter Jones
  "xbobbybell": ["xbobbybell-v4", "own:xbobbybell.webp", "", "", "", 0], // Bobby Bell
  "xbriandawkins": ["xbriandawkins-v3", "Brian_Dawkins.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2009], // Brian Dawkins
  "xbrianurlacher": ["xbrianurlacher-v1", "own:xbrianurlacher.jpg", "", "", "", 0], // Brian Urlacher
  "xcriscarter": ["xcriscarter-v3", "card:a307aca8", "", "", "", 2024], // Cris Carter
  "xdanfouts": ["xdanfouts-v5", "own:xdanfouts.jpg", "", "", "", 0], // Dan Fouts
  "xderrickbrooks": ["xderrickbrooks-v4", "own:xderrickbrooks.webp", "", "", "", 0], // Derrick Brooks
  "xforrestgregg": ["xforrestgregg-v4", "own:xforrestgregg.png", "", "", "", 0], // Forrest Gregg
  "xfrancoharris": ["xfrancoharris-v5", "own:xfrancoharris.jpg", "", "", "", 0], // Franco Harris
  "xgeneupshaw": ["xgeneupshaw-v1", "own:xgeneupshaw.jpg", "", "", "", 0], // Gene Upshaw
  "xhowielong": ["xhowielong-v3", "card:5a7121ca", "", "", "", 2025], // Howie Long
  "xjimkelly": ["xjimkelly-v4", "own:xjimkelly.jpg", "", "", "", 0], // Jim Kelly
  "xjimotto": ["xjimotto-v1", "own:xjimotto.jpg", "", "", "", 0], // Jim Otto
  "xjustintucker": ["xjustintucker-v4", "flickr:joeglo/50425638927", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/", 2020], // Justin Tucker
  "xkellenwinslow": ["xkellenwinslow-v3", "card:cb5223cc", "", "", "", 2025], // Kellen Winslow
  "xkurtwarner": ["xkurtwarner-v4", "own:xkurtwarner.jpg", "", "", "", 0], // Kurt Warner
  "xlougroza": ["xlougroza-v4", "own:xlougroza.png", "", "", "", 0], // Lou Groza
  "xmarcusallen": ["xmarcusallen-v3", "1985_Police_Raiders-Rams_-_01_Marcus_Allen_(crop).jpg", "KIIS Radio/Los Angeles Raiders/Los Angeles County Sheriff's Department", "Public domain", "", 1984], // Marcus Allen
  "xmikehaynes": ["xmikehaynes-v4", "own:xmikehaynes.png", "", "", "", 0], // Mike Haynes
  "xpaulwarfield": ["xpaulwarfield-v3", "card:d8279589", "", "", "", 2025], // Paul Warfield
  "xrandywhite": ["xrandywhite-v4", "own:xrandywhite.webp", "", "", "", 0], // Randy White
  "xshannonsharpe": ["xshannonsharpe-v3", "card:e822db1d", "", "", "", 2000], // Shannon Sharpe
  "xterrybradshaw": ["xterrybradshaw-v4", "own:xterrybradshaw.jpg", "", "", "", 0], // Terry Bradshaw
  "xtonydorsett": ["xtonydorsett-v3", "card:ce1bc138", "", "", "", 2025], // Tony Dorsett
  "xtroyaikman": ["xtroyaikman-v4", "own:xtroyaikman.jpg", "", "", "", 0], // Troy Aikman
  "xwarrensapp": ["xwarrensapp-v3", "card:83ff64af", "", "", "", 2024], // Warren Sapp
  "xwilliebrown": ["xwilliebrown-v4", "own:xwilliebrown.png", "", "", "", 0], // Willie Brown
  "xwillielanier": ["xwillielanier-v4", "own:xwillielanier.jpg", "", "", "", 0], // Willie Lanier
  "xbuckbuchanan": ["xbuckbuchanan-v4", "own:xbuckbuchanan.png", "", "", "", 0], // Buck Buchanan
  "xcurtismartin": ["xcurtismartin-v4", "own:xcurtismartin.jpg", "", "", "", 0], // Curtis Martin
  "xdonmaynard": ["xdonmaynard-v1", "own:xdonmaynard.jpg", "", "", "", 0], // Don Maynard
  "xemlentunnell": ["xemlentunnell-v2", "own:xemlentunnell.jpg", "", "", "", 0], // Emlen Tunnell
  "xherbadderley": ["xherbadderley-v4", "own:xherbadderley.png", "", "", "", 0], // Herb Adderley
  "xjackyoungblood": ["xjackyoungblood-v3", "card:899af938", "", "", "", 2022], // Jack Youngblood
  "xjanstenerud": ["xjanstenerud-v1", "own:xjanstenerud.jpg", "", "", "", 0], // Jan Stenerud
  "xjohnmackey": ["xjohnmackey-v1", "own:xjohnmackey.jpg", "", "", "", 0], // John Mackey
  "xjohnrandle": ["xjohnrandle-v4", "own:xjohnrandle.jpg", "", "", "", 0], // John Randle
  "xkenhouston": ["xkenhouston-v4", "own:xkenhouston.png", "", "", "", 0], // Ken Houston
  "xlarrycsonka": ["xlarrycsonka-v4", "own:xlarrycsonka.jpg", "", "", "", 0], // Larry Csonka
  "xlarrywilson": ["xlarrywilson-v1", "own:xlarrywilson.jpg", "", "", "", 0], // Larry Wilson
  "xleeroyselmon": ["xleeroyselmon-v1", "own:xleeroyselmon.jpg", "", "", "", 0], // Lee Roy Selmon
  "xlembarney": ["xlembarney-v3", "LemBarneyDET.png", "Unknown author Unknown author", "Public domain", "", 1968], // Lem Barney
  "xlendawson": ["xlendawson-v3", "Kansas_City_Chiefs_at_Denver_Broncos_1985-12-14_(ticket)_(crop).jpg", "Denver Broncos/Unlimited Printing & Systems, Inc.", "Public domain", "", 1970], // Len Dawson
  "xlennymoore": ["xlennymoore-v3", "card:4e5570dc", "", "", "", 2024], // Lenny Moore
  "xmichaelirvin": ["xmichaelirvin-v4", "own:xmichaelirvin.jpg", "", "", "", 0], // Michael Irvin
  "xmikeditka": ["xmikeditka-v5", "own:xmikeditka.jpg", "", "", "", 0], // Mike Ditka
  "xmortenandersen": ["xmortenandersen-v4", "own:xmortenandersen.png", "", "", "", 0], // Morten Andersen
  "xozzienewsome": ["xozzienewsome-v3", "card:b1de77e3", "", "", "", 2025], // Ozzie Newsome
  "xpaulkrause": ["xpaulkrause-v5", "own:xpaulkrause.jpg", "", "", "", 0], // Paul Krause
  "xsamhuff": ["xsamhuff-v4", "own:xsamhuff.jpg", "", "", "", 0], // Sam Huff
  "xsonnyjurgensen": ["xsonnyjurgensen-v1", "own:xsonnyjurgensen.jpg", "", "", "", 0], // Sonny Jurgensen
  "xtedhendricks": ["xtedhendricks-v3", "card:a96a3844", "", "", "", 2020], // Ted Hendricks
  "xthurmanthomas": ["xthurmanthomas-v1", "own:xthurmanthomas.jpg", "", "", "", 0], // Thurman Thomas
  "xtimbrown": ["xtimbrown-v4", "own:xtimbrown.jpg", "", "", "", 0], // Tim Brown
  "xwarrenmoon": ["xwarrenmoon-v3", "card:a1aa68a4", "", "", "", 2025], // Warren Moon
  "xartmonk": ["xartmonk-v4", "card:665c0883", "", "", "", 2025], // Art Monk
  "xjohnriggins": ["xjohnriggins-v3", "card:e4cafdfb", "", "", "", 2024], // John Riggins
  "xsteveatwater": ["xsteveatwater-v4", "own:xsteveatwater.jpg", "", "", "", 0], // Steve Atwater
  "0032726": ["0032726-v4", "own:0032726.jpg", "", "", "", 0], // Ka'imi Fairbairn
  "0034857": ["0034857-v4", "Josh_Allen_(30419600128).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Josh Allen
  "0037236": ["0037236-v4", "Commanders_at_Lions_(52379162544).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Aidan Hutchinson
  "0037744": ["0037744-v4", "own:0037744.jpg", "", "", "", 0], // Trey McBride
  "0038543": ["0038543-v4", "own:0038543.jpg", "", "", "", 0], // Jaxon Smith-Njigba
  "0039139": ["0039139-v4", "own:0039139.jpg", "", "", "", 0], // Jahmyr Gibbs
  "0039343": ["0039343-v4", "own:0039343.jpg", "", "", "", 0], // Kamari Lassiter
  "0029592": ["0029592-v3", "Kevin_Zeitler.JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2015], // Kevin Zeitler
  "0034973": ["0034973-v4", "Maxx_Crosby_WFT-Raiders_DEC2021.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Maxx Crosby
  "0033886": ["0033886-v4", "TJ_Watt.jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2019], // T.J. Watt
  "0035643": ["0035643-v3", "card:ab489ef6", "", "", "", 2025], // Jeffery Simmons
  "0035699": ["0035699-v4", "own:0035699.jpg", "", "", "", 0], // Jamel Dean
  "0038560": ["0038560-v4", "own:0038560.jpg", "", "", "", 0], // Jordan Battle
  "0039075": ["0039075-v4", "own:0039075.jpg", "", "", "", 0], // Puka Nacua
  "0033280": ["0033280-v4", "own:0033280.jpg", "", "", "", 0], // Christian McCaffrey
  "0036963": ["0036963-v4", "own:0036963.jpg", "", "", "", 0], // Amon-Ra St. Brown
  "0036994": ["0036994-v4", "own:0036994.png", "", "", "", 0], // Ernest Jones
  "0039338": ["0039338-v4", "own:0039338.jpg", "", "", "", 0], // Brock Bowers
  "0026498": ["0026498-v3", "card:db6e878a", "", "", "", 2025], // Matthew Stafford
  "0031565": ["0031565-v4", "own:0031565.jpg", "", "", "", 0], // Danielle Hunter
  "0037248": ["0037248-v4", "own:0037248.webp", "", "", "", 0], // James Cook
  "0037834": ["0037834-v4", "own:0037834.jpg", "", "", "", 0], // Brock Purdy
  "0039108": ["0039108-v4", "own:0039108.jpg", "", "", "", 0], // Will Anderson Jr.
  "0031279": ["0031279-v4", "own:0031279.jpg", "", "", "", 0], // Jake Matthews
  "0033132": ["0033132-v4", "own:0033132.jpg", "", "", "", 0], // Kevin Byard
  "0036358": ["0036358-v4", "Washington_at_Dallas_Photo_110_(51787382465).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // CeeDee Lamb
  "0036564": ["0036564-v4", "own:0036564.jpg", "", "", "", 0], // Talanoa Hufanga
  "0038542": ["0038542-v4", "Bijan_Robinson_2025.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Bijan Robinson
  "0039841": ["0039841-v4", "own:0039841.jpg", "", "", "", 0], // Cooper DeJean
  "0032071": ["0032071-v4", "own:0032071.jpg", "", "", "", 0], // Trent Brown
  "0034351": ["0034351-v4", "Dallas_Goedert.jpg", "AlexanderJonesi", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2019], // Dallas Goedert
  "0034974": ["0034974-v4", "own:0034974.jpg", "", "", "", 0], // Julian Love
  "0036223": ["0036223-v4", "own:0036223.jpg", "", "", "", 0], // Jonathan Taylor
  "0036900": ["0036900-v3", "Commanders_vs._Bengals_-_54752531474.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Ja'Marr Chase
  "0037238": ["0037238-v4", "own:0037238.jpg", "", "", "", 0], // Drake London
  "0037244": ["0037244-v3", "card:e854fbfe", "", "", "", 2022], // Devin Lloyd
  "0039851": ["0039851-v4", "own:0039851.jpg", "", "", "", 0], // Drake Maye
  "0033288": ["0033288-v4", "49ers_at_Redskins_2019,_George_Kittle_(48933294286).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2019], // George Kittle
  "0034815": ["0034815-v3", "Fred_Warner_49ers_2018_(cropped).jpg", "U.S. Air Force Airman 1st Class Jonathon D. A. Carnell", "Public domain", "", 2018], // Fred Warner
  "0035248": ["0035248-v4", "own:0035248.jpg", "", "", "", 0], // Zach Allen
  "0036409": ["0036409-v4", "own:0036409.jpg", "", "", "", 0], // Jordyn Brooks
  "0037192": ["0037192-v3", "card:cbb67e9a", "", "", "", 2025], // George Karlaftis
  "0038552": ["0038552-v3", "card:622671c6", "", "", "", 2025], // Riley Moss
  "0039064": ["0039064-v4", "own:0039064.webp", "", "", "", 0], // Zay Flowers
  "0032378": ["0032378-v4", "own:0032378.jpg", "", "", "", 0], // DeForest Buckner
  "0037239": ["0037239-v4", "own:0037239.jpg", "", "", "", 0], // Chris Olave
  "0038124": ["0038124-v4", "own:0038124.jpg", "", "", "", 0], // Christian Watson
  "0038386": ["0038386-v3", "Jalen_Carter.png", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2023], // Jalen Carter
  "0039404": ["0039404-v4", "own:0039404.jpg", "", "", "", 0], // Will Reichard
  "0039840": ["0039840-v4", "own:0039840.jpg", "", "", "", 0], // Austin Booker
  "0031933": ["0031933-v4", "own:0031933.webp", "", "", "", 0], // Leonard Williams
  "0032965": ["0032965-v4", "own:0032965.jpg", "", "", "", 0], // Ronnie Stanley
  "0035642": ["0035642-v3", "Commanders_vs._Jaguars_(52377888202).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Josh Hines-Allen
  "0036410": ["0036410-v3", "Commanders_vs._Bengals_-_54752649825.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tee Higgins
  "0036914": ["0036914-v3", "card:2f56d602", "", "", "", 2025], // Greg Rousseau
  "0037740": ["0037740-v3", "card:22c9ed76", "", "", "", 2025], // Garrett Wilson
  "0037840": ["0037840-v3", "card:a24b3e85", "", "", "", 2025], // Kyren Williams
  "0039065": ["0039065-v4", "own:0039065.jpg", "", "", "", 0], // Sam LaPorta
  "0039111": ["0039111-v3", "Tuli_Tuipulotu.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tuli Tuipulotu
  "0039337": ["0039337-v4", "Commanders_vs._Giants_2025_20.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Malik Nabers
  "0040124": ["0040124-v3", "card:d8dee6c4", "", "", "", 2025], // Tetairoa McMillan
  "0040148": ["0040148-v4", "own:0040148.jpg", "", "", "", 0], // Xavier Watts
  "0041509": ["0041509-v3", "card:363a9aef", "", "", "", 2026], // Arvell Reese
  "0031492": ["0031492-v3", "Jason_Myers_-_51720303739_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Jason Myers
  "0033106": ["0033106-v4", "Jared_Goff_2022.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Jared Goff
  "0033831": ["0033831-v4", "own:0033831.jpg", "", "", "", 0], // Andrew Wylie
  "0035272": ["0035272-v4", "own:0035272.png", "", "", "", 0], // Andrew Van Ginkel
  "0036388": ["0036388-v4", "own:0036388.jpg", "", "", "", 0], // Xavier McKinney
  "0036554": ["0036554-v4", "own:0036554.jpg", "", "", "", 0], // Nico Collins
  "0036986": ["0036986-v3", "card:43715dbb", "", "", "", 2021], // Nahshon Wright
  "0036997": ["0036997-v4", "Javonte_WIlliams_2025.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Javonte Williams
  "0038038": ["0038038-v4", "own:0038038.jpg", "", "", "", 0], // Kyle Hamilton
  "0039018": ["0039018-v4", "own:0039018.jpg", "", "", "", 0], // Jack Campbell
  "0040128": ["0040128-v4", "own:0040128.jpg", "", "", "", 0], // Tyler Warren
  "0032764": ["0032764-v4", "own:0032764.jpg", "", "", "", 0], // Derrick Henry
  "0034158": ["0034158-v4", "own:0034158.jpg", "", "", "", 0], // Brian O'Neill
  "0035236": ["0035236-v4", "own:0035236.jpg", "", "", "", 0], // Byron Murphy
  "0035358": ["0035358-v4", "own:0035358.webp", "", "", "", 0], // Chase McLaughlin
  "0035647": ["0035647-v3", "card:a692a885", "", "", "", 2025], // Montez Sweat
  "0036418": ["0036418-v4", "own:0036418.jpg", "", "", "", 0], // Zack Baun
  "0036442": ["0036442-v4", "Joe_Burrow_Bengals.jpg", "AlexanderJonesi", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Joe Burrow
  "0036912": ["0036912-v3", "Devonta_Smith_2022_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // DeVonta Smith
  "0037240": ["0037240-v4", "own:0037240.png", "", "", "", 0], // Jameson Williams
  "0038996": ["0038996-v3", "2025_Commanders_at_Packers_77.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tucker Kraft
  "0039141": ["0039141-v4", "own:0039141.jpg", "", "", "", 0], // Brian Branch
  "0039340": ["0039340-v3", "card:2884fc63", "", "", "", 2024], // Laiatu Latu
  "0039852": ["0039852-v4", "own:0039852.jpg", "", "", "", 0], // Jared Verse
  "0039888": ["0039888-v4", "own:0039888.jpg", "", "", "", 0], // Quinyon Mitchell
  "0040122": ["0040122-v3", "2025_Raiders_at_Commanders_106.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Ashton Jeanty
  "0033131": ["0033131-v3", "Maliek_Collins.jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2017], // Maliek Collins
  "0034342": ["0034342-v3", "card:39210d3c", "", "", "", 2024], // Quenton Nelson
  "0034399": ["0034399-v1", "own:0034399.jpg", "", "", "", 0], // Wyatt Teller
  "0036220": ["0036220-v4", "own:0036220.jpg", "", "", "", 0], // Derrick Brown
  "0037692": ["0037692-v3", "Brandon_Aubrey_10_1_2023.jpg", "Time2Football", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2023], // Brandon Aubrey
  "0038134": ["0038134-v3", "card:ef3f7016", "", "", "", 2025], // Kenneth Walker III
  "0039838": ["0039838-v4", "own:0039838.jpg", "", "", "", 0], // Calen Bullock
  "0039860": ["0039860-v3", "card:32634834", "", "", "", 2024], // Kool-Aid McKinstry
  "0030506": ["0030506-v4", "flickr:joeglo/51614629582", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/", 2021], // Travis Kelce
  "0031364": ["0031364-v4", "own:0031364.jpg", "", "", "", 0], // Jadeveon Clowney
  "0031898": ["0031898-v4", "own:0031898.jpg", "", "", "", 0], // Alex Singleton
  "0034429": ["0034429-v3", "card:33521d8b", "", "", "", 2025], // Jordan Mailata
  "0034495": ["0034495-v4", "own:0034495.jpg", "", "", "", 0], // Evan Brown
  "0034668": ["0034668-v4", "own:0034668.jpg", "", "", "", 0], // Aaron Stinnie
  "0034675": ["0034675-v4", "own:0034675.jpg", "", "", "", 0], // Jessie Bates
  "0034752": ["0034752-v4", "own:0034752.jpg", "", "", "", 0], // Orlando Brown
  "0034759": ["0034759-v3", "Kolton_Miller_2025.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Kolton Miller
  "0034856": ["0034856-v4", "Denzel_Ward_(43775487861).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Denzel Ward
  "0035230": ["0035230-v4", "own:0035230.jpg", "", "", "", 0], // Ed Oliver
  "0035261": ["0035261-v3", "card:6069d76c", "", "", "", 2025], // Tony Pollard
  "0035687": ["0035687-v3", "card:5f794291", "", "", "", 2024], // Bobby Okereke
  "0036971": ["0036971-v4", "Trevor_Lawrence_Commanders_vs_Jaguars_SEP2022.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Trevor Lawrence
  "0036974": ["0036974-v4", "own:0036974.jpg", "", "", "", 0], // Tyson Campbell
  "0037228": ["0037228-v4", "own:0037228.jpg", "", "", "", 0], // Jaylen Warren
  "0037250": ["0037250-v4", "2022_Cleveland_Browns_Training_Camp_(52339586867).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2022], // Martin Emerson
  "0037838": ["0037838-v4", "own:0037838.jpg", "", "", "", 0], // Isaiah Likely
  "0038563": ["0038563-v3", "Tre_Tucker_(54841331175)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tre Tucker
  "0039067": ["0039067-v3", "Rashee_Rice_(55090108907)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2026], // Rashee Rice
  "0039137": ["0039137-v4", "own:0039137.jpg", "", "", "", 0], // Byron Young
  "0039309": ["0039309-v4", "own:0039309.jpg", "", "", "", 0], // Byron Murphy II
  "0039371": ["0039371-v4", "own:0039371.jpg", "", "", "", 0], // Kris Abrams-Draine
  "0039491": ["0039491-v4", "own:0039491.jpg", "", "", "", 0], // Jalen Coker
  "0039846": ["0039846-v1", "own:0039846.jpg", "", "", "", 0], // Tykee Smith
  "0040579": ["0040579-v3", "Carson_Schwesinger_2025_Browns_Camp_(cropped).jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2025], // Carson Schwesinger
  "0041528": ["0041528-v4", "own:0041528.jpg", "", "", "", 0], // Michael Taaffe
  "0032762": ["0032762-v3", "Chris_Jones_(defensive_tackle,_born_1994).JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2017], // Chris Jones
  "0033890": ["0033890-v3", "Budda_Baker.JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2017], // Budda Baker
  "0034768": ["0034768-v3", "Chukwuma_Okorafor_(50695534763)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Chukwuma Okorafor
  "0034790": ["0034790-v5", "Derwin_James_-_2025_Commanders_at_Chargers.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Derwin James
  "0034836": ["0034836-v3", "Braden_Smith_at_Lambeau_Field.jpg", "Jhansen23", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2024], // Braden Smith
  "0035676": ["0035676-v4", "own:0035676.jpg", "", "", "", 0], // A.J. Brown
  "0036322": ["0036322-v3", "Jefferson_2022.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Justin Jefferson
  "0036500": ["0036500-v4", "own:0036500.jpg", "", "", "", 0], // Jamien Sherwood
  "0036624": ["0036624-v4", "own:0036624.jpg", "", "", "", 0], // Alim McNeill
  "0039172": ["0039172-v4", "own:0039172.jpg", "", "", "", 0], // Jake Bates
  "0039918": ["0039918-v3", "Commanders_vs._Bears_(54857809842).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Caleb Williams
  "0040663": ["0040663-v4", "Harold_Fannin_Jr._3.jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Harold Fannin Jr.
  "0033873": ["0033873-v3", "card:6e94ee7f", "", "", "", 2020], // Patrick Mahomes
  "0034796": ["0034796-v3", "Lamar_Jackson_passing_2020_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Lamar Jackson
  "0039163": ["0039163-v4", "own:0039163.jpg", "", "", "", 0], // C.J. Stroud
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
  // (a photo the owner collected himself, 'own:<file>': no author or licence to credit)
  if (r[1].startsWith('own:')) return {own: true, year: r[5] || 0};
  if (r[1].startsWith('flickr:')) {
    // (a Flickr photo, 'flickr:<owner>/<photo id>': its page on Flickr)
    return {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://www.flickr.com/photos/${r[1].slice(7)}`, site: 'Flickr', year: r[5] || 0};
  }
  return {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r[1])}`, site: 'Wikimedia Commons', year: r[5] || 0};
}
