// Playing-days photos on the 90+ cards (the owner, Oct 31 2026: "The pictures being used for the legend players are too
// formal ... for any players that are in the 90+ overall club. Find photos of them playing or some sort of playing card
// design"): a freely licensed Wikimedia Commons photo of the player in uniform from his playing days (a game, a Pro Bowl,
// a period trading card), chosen by eye with tools/dynasty/action_photos.py and cropped to img/dynasty/action/<key>.jpg.
// Every card of his rated CLUB or more wears it (core/dynasty.js setData: head 'a:<key>'), in place of a Legend's lead
// photo (core/dynasty-legends.js) or a Live player's headshot; his other cards keep theirs. Like the Legends' photos, his
// card up close credits the author, licence and Commons page, which the licences require.
// ACTION: player key (data/dynasty.json players) -> [file, Commons file name, author, licence, licence URL, year taken].

// <action-photos> (written by tools/dynasty/action_photos.py)
export const ACTION = {
  "xjerryrice": ["xjerryrice", "Jerry_Rice_1985.jpg", "Uncredited (AP)", "Public domain", "", 1985], // Jerry Rice
  "xlawrencetaylor": ["xlawrencetaylor", "Lawrence_Taylor_tackle.jpg", "Uncredited (AP)", "Public domain", "", 1984], // Lawrence Taylor
  "xtombrady": ["xtombrady", "Tom_Brady_WFT-Buccaneers_NOV2021_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Tom Brady
  "xjimbrown": ["xjimbrown", "Jim_Brown_1959_Topps_cropped_and_recoloured.jpg", "Topps", "Public domain", "", 1959], // Jim Brown
  "xpeytonmanning": ["xpeytonmanning", "Manning_cropped.jpg", "derivative work: Ytoyoda ( talk ) Manning_on_the_sidelines.jpg : Craig ONeal", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2008], // Peyton Manning
  "xreggiewhite": ["xreggiewhite", "19981213_28_Reggie_White,_Lambeau_Field_(cropped).jpg", "David Wilson", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 1998], // Reggie White
  "xaarondonald": ["xaarondonald", "Aaron_Donald_2020_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Aaron Donald
  "xjoemontana": ["xjoemontana", "1986_Jeno's_Pizza_-_28_-_Roger_Craig_(Joe_Montana_crop).jpg", "Jeno's", "Public domain", "", 1985], // Joe Montana
  "xjohnnyunitas": ["xjohnnyunitas", "1958_topps_johnny_unitas.jpg", "Unknown author Unknown author", "Public domain", "", 1958], // Johnny Unitas
  "xrandymoss": ["xrandymoss", "Randy-Moss_8-28-09_Patriots-vs-Redskins.jpg", "[2] from Baltimore, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2009], // Randy Moss
  "xraylewis": ["xraylewis", "Ray-Lewis-2008-Steelers-regseason-game.jpg", "Andy from Pittsburgh, Pennsylvania. Cropped by User:Blueag9 .", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // Ray Lewis
  "xwalterpayton": ["xwalterpayton", "1986_Jeno's_Pizza_-_12_-_Walter_Payton_(Walter_Payton_crop).jpg", "Jeno's", "Public domain", "", 1984], // Walter Payton
  "xcalvinjohnson": ["xcalvinjohnson", "Calvin_Johnson_(cropped).png", "Kevind810", "GFDL", "http://www.gnu.org/copyleft/fdl.html", 2012], // Calvin Johnson
  "xdeaconjones": ["xdeaconjones", "Deacon_Jones.png", "Wonderful World Stamps", "Public domain", "", 1972], // Deacon Jones
  "xedreed": ["xedreed", "Ed_reed_ravens2012.jpg", "Maryland National Guard", "Public domain", "", 2012], // Ed Reed
  "xgalesayers": ["xgalesayers", "Gale_sayers_playing.jpg", "Unknown", "Public domain", "", 1972], // Gale Sayers
  "xjoegreene": ["xjoegreene", "Mean_Joe_Greene_1975.JPG", "The Steelers / NFL", "Public domain", "", 1975], // Joe Greene
  "xladainiantomli": ["xladainiantomli", "LT_Chargers.jpg", "Keith Allison", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2006], // LaDainian Tomlinson
  "xrobgronkowski": ["xrobgronkowski", "Rob_Gronkowski_2021_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Rob Gronkowski
  "xronnielott": ["xronnielott", "Ronnie_lott_big_portrait.jpg", "User Mullethair", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2013], // Ronnie Lott
  "xadamvinatieri": ["xadamvinatieri", "Rigoberto_Sanchez,_Adam_Vinatieri_(44679700592)_(cropped).jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2018], // Adam Vinatieri
  "xboblilly": ["xboblilly", "Bob_lilly_signed.jpg", "Unknown author Unknown author", "Public domain", "", 1961], // Bob Lilly
  "xbrettfavre": ["xbrettfavre", "19981213_36_Brett_Favre,_Lambeau_Field_Cropped.jpg", "David Wilson", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 1998], // Brett Favre
  "xdarrellerevis": ["xdarrellerevis", "Darrelle_Revis_2014.jpg", "Andrew Campbell", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2007], // Darrelle Revis
  "xdicknighttrain": ["xdicknighttrain", "Dick_Lane_1962.JPG", "Detroit Lions \\ NFL", "Public domain", "", 2014], // Dick "Night Train" Lane
  "xdrewbrees": ["xdrewbrees", "New_Orleans_Saints_Quarterback,_Drew_Brees_(23262414434)_(cropped).jpg", "Tammy Anthony Baker from Louisiana", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2013], // Drew Brees
  "xericdickerson": ["xericdickerson", "1985_Police_Raiders-Rams_-_20_Eric_Dickerson_(crop).jpg", "KIIS Radio/Los Angeles Rams/Los Angeles County Sheriff's Department", "Public domain", "", 1984], // Eric Dickerson
  "xjacklambert": ["xjacklambert", "Jack_Lambert_in_December_1975.JPG", "Malcolm Emmons", "Public domain", "", 1975], // Jack Lambert
  "xjjwatt": ["xjjwatt", "JJ_Watt_(cropped1).JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2012], // J.J. Watt
  "xlancealworth": ["xlancealworth", "Lance_Alworth_wr_(cropped).jpg", "Unknown author Unknown author", "Public domain", "", 1969], // Lance Alworth
  "xlarryallen": ["xlarryallen", "Larry_Allen_in_2007.jpg", "John Martinez Pavliga", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2007], // Larry Allen
  "xrogerstaubach": ["xrogerstaubach", "Staubach_cowboys_qb.jpg", "Unknown author Unknown author", "Public domain", "", 1976], // Roger Staubach
  "xtonygonzalez": ["xtonygonzalez", "Pass-Interference-Chargers-vs-Chiefs-Nov-9-08.jpg", "Dirk Hansen . Cropped/edited by User:Blueag9 .", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // Tony Gonzalez
  "xtroypolamalu": ["xtroypolamalu", "Troy_Polamalu_2013_(cropped).jpg", "original: Paula Lively derivative: Diddykong1130", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2013], // Troy Polamalu
  "xadrianpeterson": ["xadrianpeterson", "Adrian_Peterson_Vikings.jpg", "Arvee5.0", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2012], // Adrian Peterson
  "xalanpage": ["xalanpage", "1986_Jeno's_Pizza_-_18_-_Alan_Page_(Alan_Page_crop).jpg", "Jeno's", "Public domain", "", 1977], // Alan Page
  "xbartstarr": ["xbartstarr", "Bart_Starr_1958.jpg", "Vintage Football Card Gallery", "Public domain", "", 1958], // Bart Starr
  "xbrucematthews": ["xbrucematthews", "Bruce_Matthews_cropped.jpg", "Jerry Sherk ( talk )", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 1984], // Bruce Matthews
  "xchampbailey": ["xchampbailey", "Champ_Bailey_2010.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2010], // Champ Bailey
  "xcharleswoodson": ["xcharleswoodson", "Charles_Woodson_2014_2_(cropped).JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2014], // Charles Woodson
  "xchuckbednarik": ["xchuckbednarik", "ChuckBednarik1952Bowman.jpg", "Unknown author Unknown author", "Public domain", "", 1952], // Chuck Bednarik
  "xdarrellgreen": ["xdarrellgreen", "Darrell_Green_8-4-02_020804-N-5086M-004.jpg", "Photographer’s Mate 2nd Class Greg Mitchell, USN", "Public domain", "", 2002], // Darrell Green
  "xfrantarkenton": ["xfrantarkenton", "Tarkenton_calling_vikings.jpg", "Unknown author Unknown author", "Public domain", "", 1978], // Fran Tarkenton
  "xginomarchetti": ["xginomarchetti", "Gino_Marchetti_1961.jpg", "Jay Publishing", "Public domain", "", 1961], // Gino Marchetti
  "xjackham": ["xjackham", "JackHamPIT.png", "Unknown author Unknown author", "Public domain", "", 1982], // Jack Ham
  "xjimparker": ["xjimparker", "Parker-Jim-1960.jpg", "Unknown author", "Public domain", "", 0], // Jim Parker
  "xjoenamath": ["xjoenamath", "1986_Jeno's_Pizza_-_37_-_Joe_Namath_(Joe_Namath_crop).jpg", "Jeno's", "Public domain", "", 1969], // Joe Namath
  "xjuniorseau": ["xjuniorseau", "Junior_Seau_with_Patriots_side_view_cropped.jpg", "Junior_Seau_with_Patriots_side_view.jpg : Dave Sizer derivative work: Bagumba", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // Junior Seau
  "xmarvinharrison": ["xmarvinharrison", "Marvin_Harrison_in_2007_Training_Camp_2.jpg", "The original uploader was Djmunden at English Wikipedia .", "CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5", 2008], // Marvin Harrison
  "xmerlinolsen": ["xmerlinolsen", "Merlin_Olsen.png", "Wonderful World Stamps", "Public domain", "", 1971], // Merlin Olsen
  "xraymondberry": ["xraymondberry", "Berry_1961_Topps.jpg", "Topps", "Public domain", "", 1961], // Raymond Berry
  "xraynitschke": ["xraynitschke", "Nitschke_packers.jpg", "Unknown author Unknown author", "Public domain", "", 1966], // Ray Nitschke
  "xstevelargent": ["xstevelargent", "SteveLargent.png", "Unknown author Unknown author", "Public domain", "", 1985], // Steve Largent
  "xterrellowens": ["xterrellowens", "Terrell-Owens-Aug302007-Vikings-Preseason.jpg", "suzismini . Cropped by User:Blueag9 .", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2007], // Terrell Owens
  "xwalterjones": ["xwalterjones", "Walter-Jones-2008-11-02-vsEagles.jpg", "Luis Antonio Rodríguez Ochoa from Redmond, Washington. Cropped by User:Blueag9 .", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2008], // Walter Jones
  "xbriandawkins": ["xbriandawkins", "Brian_Dawkins.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2009], // Brian Dawkins
  "xcriscarter": ["xcriscarter", "CC_Pro_Bowl.JPG", "Justvikings ( talk ) ( Uploads )", "Public domain", "", 1999], // Cris Carter
  "xdanfouts": ["xdanfouts", "1986_Jeno's_Pizza_-_53_-_Dan_Fouts_and_Don_Macek_(Dan_Fouts_crop).jpg", "Jeno's", "Public domain", "", 1982], // Dan Fouts
  "xderrickbrooks": ["xderrickbrooks", "Dbrooks_03_(cropped).jpg", "Spiderman789", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2003], // Derrick Brooks
  "xforrestgregg": ["xforrestgregg", "ForrestGreggGB.png", "Unknown author Unknown author", "Public domain", "", 1963], // Forrest Gregg
  "xfrancoharris": ["xfrancoharris", "1986_Jeno's_Pizza_-_46_-_Terry_Bradshaw_(Franco_Harris_crop).jpg", "Jeno's", "Public domain", "", 1980], // Franco Harris
  "xjustintucker": ["xjustintucker", "Justin_Tucker_Ravens_Camp_AUG2022_(cropped).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2022], // Justin Tucker
  "xkellenwinslow": ["xkellenwinslow", "Kellen_Winslow_circa_1986.jpg", "Oscar Mayer", "Public domain", "", 1987], // Kellen Winslow
  "xkurtwarner": ["xkurtwarner", "Kurt_Warner_(2009_Pro_Bowl).jpg", "English: Sgt. Macario P. Mora Jr", "Public domain", "", 2009], // Kurt Warner
  "xlougroza": ["xlougroza", "Lou_Groza_1957.jpg", "Topps", "Public domain", "", 1957], // Lou Groza
  "xmarcusallen": ["xmarcusallen", "1985_Police_Raiders-Rams_-_01_Marcus_Allen_(crop).jpg", "KIIS Radio/Los Angeles Raiders/Los Angeles County Sheriff's Department", "Public domain", "", 1984], // Marcus Allen
  "xpaulwarfield": ["xpaulwarfield", "Paul_Warfield_1971MIA.png", "Dell", "Public domain", "", 1971], // Paul Warfield
  "xterrybradshaw": ["xterrybradshaw", "1983_Steelers_Police_-_04_Terry_Bradshaw_(crop).jpg", "Pittsburgh Steelers/Coca-Cola/Kiwanis International", "Public domain", "", 1982], // Terry Bradshaw
  "xwillielanier": ["xwillielanier", "WillieLanierKC.png", "Hank Young", "Public domain", "", 1986], // Willie Lanier
  "xbuckbuchanan": ["xbuckbuchanan", "BuckBuchananKC.png", "Unknown author Unknown author", "Public domain", "", 1965], // Buck Buchanan
  "xdonmaynard": ["xdonmaynard", "Don_Maynard_1963_(cropped).jpg", "Jay Publishing", "Public domain", "", 1963], // Don Maynard
  "xemlentunnell": ["xemlentunnell", "Emlen_Tunnell_1954_Bowman.jpg", "Bowman", "Public domain", "", 1954], // Emlen Tunnell
  "xjackyoungblood": ["xjackyoungblood", "JackYoungbloodLA.png", "Unknown author Unknown author", "Public domain", "", 1980], // Jack Youngblood
  "xjanstenerud": ["xjanstenerud", "Jan_stenerud_chiefs_signed_photo.jpg", "Unknown", "Public domain", "", 1967], // Jan Stenerud
  "xjohnmackey": ["xjohnmackey", "John_mackey_press_photo_1972.jpg", "Unknown", "Public domain", "", 1972], // John Mackey
  "xkenhouston": ["xkenhouston", "KenHouston.png", "Glendale Stamps", "Public domain", "", 1969], // Ken Houston
  "xlarrywilson": ["xlarrywilson", "LarryWilson.png", "Glendale Stamps", "Public domain", "", 1969], // Larry Wilson
  "xlembarney": ["xlembarney", "LemBarneyDET.png", "Unknown author Unknown author", "Public domain", "", 1968], // Lem Barney
  "xlendawson": ["xlendawson", "Kansas_City_Chiefs_at_Denver_Broncos_1985-12-14_(ticket)_(crop).jpg", "Denver Broncos/Unlimited Printing & Systems, Inc.", "Public domain", "", 1970], // Len Dawson
  "xlennymoore": ["xlennymoore", "1956_topps_lenny_moore.jpg", "Unknown author Unknown author", "Public domain", "", 1956], // Lenny Moore
  "xmikeditka": ["xmikeditka", "Mike_ditka_topps_card_cropped.jpg", "Unknown", "Public domain", "", 1963], // Mike Ditka
  "xpaulkrause": ["xpaulkrause", "1986_Jeno's_Pizza_-_18_-_Alan_Page_(Paul_Krause_crop).jpg", "Jeno's", "Public domain", "", 1977], // Paul Krause
  "xsamhuff": ["xsamhuff", "Sam_huff_redskins.jpg", "Unknown author Unknown author", "Public domain", "", 1964], // Sam Huff
  "xsonnyjurgensen": ["xsonnyjurgensen", "1958_topps_sonny_jurgensen.jpg", "Unknown", "Public domain", "", 1958], // Sonny Jurgensen
  "xwarrenmoon": ["xwarrenmoon", "Warren_Moon_and_Mike_Rozier_1987.jpg", "Houston Oilers", "Public domain", "", 1987], // Warren Moon
  "xjohnriggins": ["xjohnriggins", "JohnRiggins1983TrainingCamp.jpg", "Ted Van Pelt", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // John Riggins
  "0027857": ["0027857", "Trent_Willams_2020_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Trent Williams
  "0032726": ["0032726", "Ka'imi_Fairbairn_(45034655335)_(cropped).jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2018], // Ka'imi Fairbairn
  "0034857": ["0034857", "NFL2021_-_Washington_Football_Team_at._Buffalo_Bills_101_(51529124162).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Josh Allen
  "0037236": ["0037236", "Aidan_Hutchinson.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Aidan Hutchinson
  "0037841": ["0037841", "2025_Rams_vs_Titans_Quentin_Lake.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2025], // Quentin Lake
  "0029592": ["0029592", "Kevin_Zeitler.JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2015], // Kevin Zeitler
  "0034973": ["0034973", "Maxx_Crosby_Las_Vegas_Raiders_2021_(cropped_1).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Maxx Crosby
  "0030097": ["0030097", "David_Quessenberry_2021_09-19.jpg", "Chipermc", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2021], // David Quessenberry
  "0033886": ["0033886", "TJWatt2025.jpg", "Cramerwiki", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // T.J. Watt
  "0035643": ["0035643", "2026_Tennessee_Titans_New_Jersey_Photo_Shoot_-_Jeffery_Simmons_(cropped).png", "Tennessee Titans", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Jeffery Simmons
  "0035699": ["0035699", "Steelers_vs_Bucs_10.18.2026_2_(cropped).jpg", "ANTbook365", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", 2026], // Jamel Dean
  "0039075": ["0039075", "Nacua_731_(cropped_2).jpg", "Sewageboy", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2023], // Puka Nacua
  "0033280": ["0033280", "Christian_McCaffrey.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2019], // Christian McCaffrey
  "0036963": ["0036963", "Amon-Ra_St._Brown_vs._Commanders_2022_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Amon-Ra St. Brown
  "0039338": ["0039338", "Brock_Bowers_(2025).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Brock Bowers
  "0026498": ["0026498", "2025_Rams_vs_Titans_Matthew_Stafford_(cropped).png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2025], // Matthew Stafford
  "0031565": ["0031565", "Danielle_Hunter.JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2015], // Danielle Hunter
  "0037248": ["0037248", "JamesCookProBowl2024_(cropped).jpg", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2024], // James Cook
  "0037834": ["0037834", "Brock_Purdy_injury_49ers_Bears_2024.jpg", "ZappaOMatic", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", 2024], // Brock Purdy
  "0030561": ["0030561", "Eagles_at_Redskins_2017.jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2017], // Lane Johnson
  "0031279": ["0031279", "Jake_Matthews_&_Matt_Ryan_vs_WFT_2021_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Jake Matthews
  "0033132": ["0033132", "Jeffery_Simmons_&_Kevin_Byard_Oilers_Throwback_Jerseys.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2023], // Kevin Byard
  "0036358": ["0036358", "CeeDee_Lamb_Cowboys_(cropped).jpg", "AlexanderJonesi", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // CeeDee Lamb
  "0036564": ["0036564", "Hufanga_2025.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2025], // Talanoa Hufanga
  "0031330": ["0031330", "NFL_2020_-_Playoffs_-_Washington_vs._Buccaneers_209_(50833182757).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Morgan Moses
  "0032071": ["0032071", "Trenton_Brown.JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2015], // Trent Brown
  "0034351": ["0034351", "Dallas_Goedert_(52510560186)_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Dallas Goedert
  "0034974": ["0034974", "Julian_Love_(cropped).jpg", "AlexanderJonesi", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2019], // Julian Love
  "0036223": ["0036223", "Jonathan_Taylor_Colts_OCT2022_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Jonathan Taylor
  "0036900": ["0036900", "Commanders_vs._Bengals_-_54752531474.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Ja'Marr Chase
  "0037238": ["0037238", "Drake_London_Falcons_camp_2022.png", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2022], // Drake London
  "0037244": ["0037244", "Devin_Lloyd_and_Logan_Thomas_2022_2.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Devin Lloyd
  "0039851": ["0039851", "Drake_Maye_Patriots_vs_Titans_NOV2024.png_(section)_(cropped).png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2024], // Drake Maye
  "0032234": ["0032234", "Laken_Tomlinson_with_49ers.jpg", "Chipermc", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2017], // Laken Tomlinson
  "0032391": ["0032391", "Joe_Thuney.JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2017], // Joe Thuney
  "0032445": ["0032445", "Ted_Karras_(offensive_lineman).JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2016], // Ted Karras
  "0033288": ["0033288", "George_Kittle_DSC08082_(48940368597)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2019], // George Kittle
  "0034815": ["0034815", "Fred_Warner_49ers_2018_(cropped).jpg", "U.S. Air Force Airman 1st Class Jonathon D. A. Carnell", "Public domain", "", 2018], // Fred Warner
  "0035248": ["0035248", "Zach_Allen.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2025], // Zach Allen
  "0036409": ["0036409", "Jordyn_Brooks_(50744647202)_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Jordyn Brooks
  "0038552": ["0038552", "Riley_Moss_Broncos.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2025], // Riley Moss
  "0039064": ["0039064", "Ravens_Training_Camp_(53880447586).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2024], // Zay Flowers
  "0032378": ["0032378", "DeForest_Buckner.JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2016], // DeForest Buckner
  "0033281": ["0033281", "Marlon_Humphrey_Baltimore_Ravens_2021_(cropped).jpg", "AlexanderJonesi", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Marlon Humphrey
  "0037191": ["0037191", "Washington_Commanders_at_Kansas_City_Chiefs_(55091195803).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2026], // Trent McDuffie
  "0038124": ["0038124", "Pass_interference_-_Detroit_Lions_vs_Green_Bay_Packers_2022_Week_18.jpg", "CBS / Highlight Heaven", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2023], // Christian Watson
  "0039813": ["0039813", "Evan_Williams_(safety).jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Evan Williams
  "0031933": ["0031933", "Leonard_Williams_WSH_vs_NYG_OCT2023_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2023], // Leonard Williams
  "0032965": ["0032965", "Ronnie_Stanley_Ravens_Training_Camp_AUG2023_(cropped).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2023], // Ronnie Stanley
  "0033082": ["0033082", "Lucas_Patrick_(Green_Bay_Packers_player)_during_pre-season_game_against_Washington_Redskins_on_August_19,_2017_in_Maryland.jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2017], // Lucas Patrick
  "0035642": ["0035642", "Commanders_vs._Jaguars_(52377888202).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Josh Hines-Allen
  "0036410": ["0036410", "Commanders_vs._Bengals_-_54752649825.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tee Higgins
  "0036914": ["0036914", "Gregory_Rousseau_(51528386792)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Greg Rousseau
  "0039111": ["0039111", "Tuli_Tuipulotu.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tuli Tuipulotu
  "0039337": ["0039337", "Malik_Nabers_Giants_week_1_2025.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Malik Nabers
};
// </action-photos>

/** The rating a card needs to wear its player's playing-days photo. */
export const CLUB = 90;
/** A player's playing-days photo (p: his key), '' for none. */
export const actionUrl = p => (ACTION[p] ? `img/dynasty/action/${ACTION[p][0]}.jpg` : '');
/** Its credit: {author, licence, licenceUrl, page (its Wikimedia Commons page), year}, null for none. */
export function actionCredit(p) {
  const r = ACTION[p];
  return r ? {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r[1])}`, year: r[5] || 0} : null;
}
