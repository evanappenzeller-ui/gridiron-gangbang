// The Legends' photos in Gridiron Rivals (the owner, Oct 31 2026: "Import into game for me to see"): each Legend's
// Wikipedia lead photo where it's freely licensed (Wikimedia Commons), cropped round his face by
// tools/dynasty/legend_photos.py as img/dynasty/legends/<file>.jpg. The photo is his card's portrait (core/dynasty.js
// setData: head 'w:<key>'); his card up close credits its author and licence (views/dynasty.js photoCredit).
// PHOTO: player key (data/dynasty.json players) -> [file, Commons file name, author, licence, licence URL].

// <legend-photos> (written by tools/dynasty/legend_photos.py)
export const PHOTO = {
  "xtombrady": ["xtombrady", "25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Tom_Brady_-_240422_191334_(cropped)_(cropped).jpg", "Barcex", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0"], // Tom Brady
  "xjerryrice": ["xjerryrice", "Super_Bowl_44_Miami_Florida_NFL_Network_South_Beach_Set_Deon_Sanders_interviews_Jerry_Rice_(4331549867)_(cropped)_-_Jerry_Rice.jpg", "Anthony Quintano from Honolulu, HI, United States", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Jerry Rice
  "xlawrencetaylor": ["xlawrencetaylor", "Lawrence_Taylor_in_2025_(cropped).jpg", "The White House", "Public domain", ""], // Lawrence Taylor
  "xbarrysanders": ["xbarrysanders", "Barry_Sanders_2019.jpg", "Greg2600", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Barry Sanders
  "xpeytonmanning": ["xpeytonmanning", "Peyton_Manning_(51665689271).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Peyton Manning
  "xreggiewhite": ["xreggiewhite", "Reggie_White_at_the_White_House.jpg", "Barbara Kinney", "Public domain", ""], // Reggie White
  "xjimbrown": ["xjimbrown", "Jim_Brown_1959_Topps_cropped_and_recoloured.jpg", "Topps", "Public domain", ""], // Jim Brown
  "xjoemontana": ["xjoemontana", "Joe_Montana_ESPN_cropped2.jpg", "photo taken by flcikr user Phil Hull", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Joe Montana
  "xdeionsanders": ["xdeionsanders", "Deion_Sanders_(8216060)_(cropped).jpg", "U.S. Marine Corps photo by Sgt. Lydia Gordon", "Public domain", ""], // Deion Sanders
  "xwalterpayton": ["xwalterpayton", "1986_Jeno's_Pizza_-_12_-_Walter_Payton_(Walter_Payton_crop)_(cropped).jpg", "Jeno's", "Public domain", ""], // Walter Payton
  "xrandymoss": ["xrandymoss", "Randy_Moss_2016.jpg", "Keith Allison", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Randy Moss
  "xaarondonald": ["xaarondonald", "Aaron_Donald_2020_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Aaron Donald
  "xraylewis": ["xraylewis", "Ray_Lewis_2015_(cropped).jpg", "Keith Allison", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Ray Lewis
  "xanthonymuñoz": ["xanthonymunoz", "Anthony_Muñoz_2015.jpg", "Cheryle Rivas", "Public domain", ""], // Anthony Muñoz
  "xedreed": ["xedreed", "Ed_Reed_by_Gage_Skidmore.jpg", "Gage Skidmore", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Ed Reed
  "xronnielott": ["xronnielott", "Ronnie_Lott_and_Jim_Plunkett_(CrashCouse_Launch_PSA)_(cropped)Lott.png", "TeachAids", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Ronnie Lott
  "xdanmarino": ["xdanmarino", "Danmarino.jpg", "Unknown author", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Dan Marino
  "xcalvinjohnson": ["xcalvinjohnson", "Calvin_Johnson_by_Gage_Skidmore.jpg", "Gage Skidmore", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Calvin Johnson
  "xrobgronkowski": ["xrobgronkowski", "231208-N-QE848-2422_(53391476156)_(Rob_Gronkowski).jpg", "United States Naval Academy Photo Archive from United States", "Public domain", ""], // Rob Gronkowski
  "xtonygonzalez": ["xtonygonzalez", "Tony_Gonzalez_Thursday_Night_Football_DEC2023_(cropped).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Tony Gonzalez
  "xladainiantomli": ["xladainiantomli", "LaDainian_Tomlinson_2017_closeup.jpg", "original: U.S. Navy MC2 Jesse Monford on behalf of Naval Surface Warriors derivative: Diddykong1130", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // LaDainian Tomlinson
  "xjjwatt": ["xjjwatt", "J.J._Watt_2018—2.JPG", "Denverjeffrey", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0"], // J.J. Watt
  "xbrucesmith": ["xbrucesmith", "Bruce_Smith_Virginia_Tech.jpg", "VaMedia", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Bruce Smith
  "xdarrellerevis": ["xdarrellerevis", "Darrelle_Revis_ESPNWeekend2010-051.jpg", "Jeff Kern", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Darrelle Revis
  "xchampbailey": ["xchampbailey", "Champ_Bailey_2010.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Champ Bailey
  "xtroypolamalu": ["xtroypolamalu", "Polamalu_closeup2.jpg", "Sodexo USA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Troy Polamalu
  "xdickbutkus": ["xdickbutkus", "Dickbutkus.jpg", "Alan Light", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Dick Butkus
  "xbrianurlacher": ["xbrianurlacher", "Brian_Urlacher_(15795829749)_(1).jpg", "US Army Africa from Vicenza, Italy", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Brian Urlacher
  "xemmittsmith": ["xemmittsmith", "Super_Bowl_44_Emmitt_Smith_(4344089199)_(cropped).jpg", "Anthony Quintano from Honolulu, HI, United States", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Emmitt Smith
  "xadrianpeterson": ["xadrianpeterson", "Adrian_Peterson_2026_(cropped).jpg", "2C2K Photography", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0"], // Adrian Peterson
  "xmarshallfaulk": ["xmarshallfaulk", "Marshall_Faulk_by_Gage_Skidmore.jpg", "Gage Skidmore", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Marshall Faulk
  "xterrellowens": ["xterrellowens", "Terrell_Owens_2017-05-02_(34255853692)_(cropped).jpg", "Collision Conf from New Orleans, Louisiana, USA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Terrell Owens
  "xjohnelway": ["xjohnelway", "John_Elway_OCT2021_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // John Elway
  "xbrettfavre": ["xbrettfavre", "Brett_Favre_Super_Bowl_50.jpg", "Arnie Papp", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Brett Favre
  "xdrewbrees": ["xdrewbrees", "MedalCeremony_1_011520_(61_of_69)_(49396271982)_(cropped).jpg", "Senate Democrats", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Drew Brees
  "xlarryallen": ["xlarryallen", "Larry_Allen_in_2007.jpg", "John Martinez Pavliga", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Larry Allen
  "xjonathanogden": ["xjonathanogden", "Jonathan_Ogden_Headshot.jpg", "WendyHerr", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0"], // Jonathan Ogden
  "xjoethomas": ["xjoethomas", "Joe_Thomas_Cleveland_Browns_New_Uniform_Unveiling_(16968332879).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Joe Thomas
  "xcharleswoodson": ["xcharleswoodson", "Charles_Woodson_2014_2.JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0"], // Charles Woodson
  "xrodwoodson": ["xrodwoodson", "Rod_Woodson_Jan_2019.jpg", "Thomson200", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en"], // Rod Woodson
  "xadamvinatieri": ["xadamvinatieri", "Rigoberto_Sanchez,_Adam_Vinatieri_(44679700592)_(cropped).jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Adam Vinatieri
  "xjustintucker": ["xjustintucker", "Justin_Tucker_JUL2024_(53880733153).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Justin Tucker
  "xjuniorseau": ["xjuniorseau", "Junior_Seau_2.JPG", "JJ Hall", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Junior Seau
  "xmichaelstrahan": ["xmichaelstrahan", "Michael_Strahan_2022_(cropped).jpg", "Airman 1st Class Andrew Britten", "Public domain", ""], // Michael Strahan
  "xjohnnyunitas": ["xjohnnyunitas", "Unitas-Johnny-1963.jpg", "Unknown author", "PD-US", ""], // Johnny Unitas
  "xbartstarr": ["xbartstarr", "Bart_starr_bw.jpg", "Unknown author Unknown author", "Public domain", ""], // Bart Starr
  "xjoenamath": ["xjoenamath", "Namath_1965.jpg", "New York Jets", "Public domain", ""], // Joe Namath
  "xrogerstaubach": ["xrogerstaubach", "President_Donald_J._Trump_Presents_Medal_of_Freedom_-_45863432812_(cropped).jpg", "The White House", "Public domain", ""], // Roger Staubach
  "xterrybradshaw": ["xterrybradshaw", "Terry_Bradshaw_Meet_and_Greet_ASI_Chicago_show_071521-7_(51321819538).jpg", "The ASI Show", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Terry Bradshaw
  "xfrantarkenton": ["xfrantarkenton", "Fran_Tarkenton_January_2010.jpg", "Steve Burns", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Fran Tarkenton
  "xlendawson": ["xlendawson", "LenDawson.JPG", "U.S. Air Force photo by Airman 1st Class Joel Pfiester/Released", "Public domain", ""], // Len Dawson
  "xsonnyjurgensen": ["xsonnyjurgensen", "Sonny_Jurgensen.jpg", "National Football League", "Public domain", ""], // Sonny Jurgensen
  "xdanfouts": ["xdanfouts", "Dan_Fouts.jpg", "Rex Lilly", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Dan Fouts
  "xsteveyoung": ["xsteveyoung", "Steve_Young_(6837509849)_(cropped).jpg", "SAB0TEUR", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Steve Young
  "xtroyaikman": ["xtroyaikman", "Troy_aikman_2011_cropped.jpg", "Leahdi", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Troy Aikman
  "xjimkelly": ["xjimkelly", "Jim_Kelly_2010.jpg", "Staff Sgt. Corenthia Fennell", "Public domain", ""], // Jim Kelly
  "xwarrenmoon": ["xwarrenmoon", "Warren_Moon_Press_Conference_Oilers_Tribute_Week_4-45_screenshot_2021_(cropped).png", "Warren Moon Press Conference | Oilers Tribute Week", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0"], // Warren Moon
  "xkurtwarner": ["xkurtwarner", "Kurt_Warner_2022_(cropped).jpg", "Staff Sgt. Cody Trimble", "Public domain", ""], // Kurt Warner
  "xgalesayers": ["xgalesayers", "Gale_sayers_playing.jpg", "Unknown", "Public domain", ""], // Gale Sayers
  "xearlcampbell": ["xearlcampbell", "Earl_campbell_shaggybevo.jpg", "TankedBevo of ShaggyBevo.com", "CC BY 2.5", "https://creativecommons.org/licenses/by/2.5"], // Earl Campbell
  "xericdickerson": ["xericdickerson", "Eric_Dickerson.jpg", "Master Sgt. Cohen A. Young", "Public domain", ""], // Eric Dickerson
  "xtonydorsett": ["xtonydorsett", "Tony_Dorsett.jpg", "OPEN Sports", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Tony Dorsett
  "xfrancoharris": ["xfrancoharris", "Franco_Harris_2022.jpg", "Governor Tom Wolf from Harrisburg, PA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Franco Harris
  "xmarcusallen": ["xmarcusallen", "Pro_Football_Hall_of_Famer_Speaks_at_Award_Ceremony_130104-A-GX635-439_(cropped).jpg", "Pfc. Victor Blanco", "Public domain", ""], // Marcus Allen
  "xthurmanthomas": ["xthurmanthomas", "Thurman_Thomas_ESPNWeekend2010-067.jpg", "Jeff Kern", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Thurman Thomas
  "xlarrycsonka": ["xlarrycsonka", "Larry_Csonka_1972.jpg", "Roy Erickson", "Public domain", ""], // Larry Csonka
  "xjohnriggins": ["xjohnriggins", "John_Riggins.jpg", "ANestSport", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0"], // John Riggins
  "xlennymoore": ["xlennymoore", "1lenny_moore.jpg", "Marylandstater", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en"], // Lenny Moore
  "xbojackson": ["xbojackson", "Bo_Jackson,_2011_NCAA_Honors_Celebration,_San_Antonio,_TX.jpg", "U.S. Army Materiel Command (AMC Photo by Chris Putman)", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Bo Jackson
  "xcurtismartin": ["xcurtismartin", "Curtis_Martin_at_2010_pep_rally.jpg", "Anthony Quintano", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Curtis Martin
  "xlancealworth": ["xlancealworth", "Lance_Alworth_wr_(cropped).jpg", "Unknown author Unknown author", "Public domain", ""], // Lance Alworth
  "xpaulwarfield": ["xpaulwarfield", "Paul_Warfield_2013.jpg", "Whitehouse.gov", "Public domain", ""], // Paul Warfield
  "xstevelargent": ["xstevelargent", "Stevelargent.jpg", "United States House of Representatives", "Public domain", ""], // Steve Largent
  "xdonmaynard": ["xdonmaynard", "Don_Maynard_1963_(cropped).jpg", "Jay Publishing", "Public domain", ""], // Don Maynard
  "xraymondberry": ["xraymondberry", "Berry_1961_Topps.jpg", "Topps", "Public domain", ""], // Raymond Berry
  "xmichaelirvin": ["xmichaelirvin", "Michael_Irvin_by_Gage_Skidmore.jpg", "Gage Skidmore", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Michael Irvin
  "xcriscarter": ["xcriscarter", "Cris_Carter_HOF.JPG", "MN National Guard", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0"], // Cris Carter
  "xartmonk": ["xartmonk", "Art_Monk_USDA_150th_Anniversary_celebration.jpg", "USDA photo by Lance Cheung", "Public domain", ""], // Art Monk
  "xtimbrown": ["xtimbrown", "Tim_Brown.jpg", "Photographer's Mate 1st Class Aviation Warfare Systems Operator Toiete Jackson", "Public domain", ""], // Tim Brown
  "xmarvinharrison": ["xmarvinharrison", "Marvin_Harrison_2022.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Marvin Harrison
  "xkellenwinslow": ["xkellenwinslow", "Kellen_Winslow_Sr_cropped.jpg", "U.S. Congressman Zach Wamp", "Public domain", ""], // Kellen Winslow
  "xmikeditka": ["xmikeditka", "Mike_ditka_topps_card_cropped.jpg", "Unknown", "Public domain", ""], // Mike Ditka
  "xjohnmackey": ["xjohnmackey", "John_mackey_press_photo_1972.jpg", "Unknown", "Public domain", ""], // John Mackey
  "xshannonsharpe": ["xshannonsharpe", "Defense.gov_photo_essay_120106-A-AO884-354_(Cropped).jpg", "Staff Sgt. Teddy Wade", "Public domain", ""], // Shannon Sharpe
  "xozzienewsome": ["xozzienewsome", "Ozzie_Newsome_Ravens_Training_Camp_-_53104237446_(cropped).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Ozzie Newsome
  "xforrestgregg": ["xforrestgregg", "ForrestGreggGB.png", "Unknown author Unknown author", "Public domain", ""], // Forrest Gregg
  "xjimparker": ["xjimparker", "Parker-Jim-1960.jpg", "Unknown author", "PD-US", ""], // Jim Parker
  "xjohnhannah": ["xjohnhannah", "John_hannah_patriots.jpg", "Mschickler", "Public domain", ""], // John Hannah
  "xartshell": ["xartshell", "Art_Shell_in_2006.jpg", "Keith Allison", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Art Shell
  "xmikewebster": ["xmikewebster", "Mike_Webster_High_School.jpg", "Rhinelander High School", "Public domain", ""], // Mike Webster
  "xjimotto": ["xjimotto", "Jim_Otto_60-74.JPG", "Cohen's", "Public domain", ""], // Jim Otto
  "xbrucematthews": ["xbrucematthews", "Bruce_Matthews.jpg", "Jerry Sherk ( talk )", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Bruce Matthews
  "xwalterjones": ["xwalterjones", "Walter-Jones-2008-11-02-vsEagles.jpg", "Luis Antonio Rodríguez Ochoa from Redmond, Washington. Cropped by User:Blueag9 .", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Walter Jones
  "xdeaconjones": ["xdeaconjones", "Deacon_Jones_in_1971_Brady_Bunch_promo.jpg", "ABC Television", "Public domain", ""], // Deacon Jones
  "xboblilly": ["xboblilly", "Bob_lilly_signed.jpg", "Unknown author Unknown author", "Public domain", ""], // Bob Lilly
  "xmerlinolsen": ["xmerlinolsen", "Merlin_Olsen_Jonathan_Garvey_Little_House_on_the_Prairie_1977.JPG", "NBC Television. While the logo portion of the press release is missing, the paper ran the photo and credited NBC as can ", "Public domain", ""], // Merlin Olsen
  "xjoegreene": ["xjoegreene", "Mean_Joe_Greene_1975.JPG", "The Steelers / NFL", "Public domain", ""], // Joe Greene
  "xalanpage": ["xalanpage", "2020JusticeAlanPage.jpg", "Self-created photograph by Jonathunder", "GFDL", ""], // Alan Page
  "xjackyoungblood": ["xjackyoungblood", "Jack5-1.jpg", "Howdythere at English Wikipedia", "Public domain", ""], // Jack Youngblood
  "xhowielong": ["xhowielong", "Howie_Long_2022_(cropped).jpg", "Airman 1st Class Andrew Britten", "Public domain", ""], // Howie Long
  "xrandywhite": ["xrandywhite", "Randy_White_signs_autographs_Jan_2014.jpg", "EricEnfermero", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Randy White
  "xginomarchetti": ["xginomarchetti", "Gino_Marchetti_-_1952_Bowman_Large.jpg", "Bowman", "Public domain", ""], // Gino Marchetti
  "xbuckbuchanan": ["xbuckbuchanan", "1986_Jeno's_Pizza_-_50_-_Buck_Buchanan_and_Curley_Culp_(Buck_Buchanan_crop).jpg", "Jeno's", "Public domain", ""], // Buck Buchanan
  "xwarrensapp": ["xwarrensapp", "Warren_Sapp_by_Gage_Skidmore.jpg", "Gage Skidmore", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Warren Sapp
  "xjohnrandle": ["xjohnrandle", "Seattle_mayor_Greg_Nickels_at_Seahawks_training_facility,_2002_(53173431923)_(cropped).jpg", "Seattle Municipal Archives from Seattle, WA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // John Randle
  "xjacklambert": ["xjacklambert", "Jack_Lambert_Ohio.jpg", "Crestwood High School", "Public domain", ""], // Jack Lambert
  "xjackham": ["xjackham", "JackHamPIT.png", "Unknown author Unknown author", "Public domain", ""], // Jack Ham
  "xmikesingletary": ["xmikesingletary", "Mike_Singletary_at_49ers_Family_Day_2009_1.JPG", "BrokenSphere", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"], // Mike Singletary
  "xwillielanier": ["xwillielanier", "WillieLanierKC.png", "Hank Young", "Public domain", ""], // Willie Lanier
  "xraynitschke": ["xraynitschke", "Nitschke_packers.jpg", "Unknown author Unknown author", "Public domain", ""], // Ray Nitschke
  "xchuckbednarik": ["xchuckbednarik", "ChuckBednarik1952Bowman.jpg", "Unknown author Unknown author", "Public domain", ""], // Chuck Bednarik
  "xbobbybell": ["xbobbybell", "Bobby_Bell_2014_(cropped).JPG", "U.S. Air Force photo by Airman 1st Class Joel Pfiester/Released", "Public domain", ""], // Bobby Bell
  "xtedhendricks": ["xtedhendricks", "Ted_Hendricks_2-4-05_050204-N-0874H-006.jpg", "Photographer’s Mate 2nd Class Charles E. Hill , USN", "Public domain", ""], // Ted Hendricks
  "xsamhuff": ["xsamhuff", "Sam_Huff.jpg", "Unknown author Unknown author", "Public domain", ""], // Sam Huff
  "xderrickbrooks": ["xderrickbrooks", "Dbrooks_03_(cropped).jpg", "Spiderman789", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0"], // Derrick Brooks
  "xmelblount": ["xmelblount", "MelBlount.jpg", "Cramerwiki", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en"], // Mel Blount
  "xdicknighttrain": ["xdicknighttrain", "Dick_Lane_1962.JPG", "Detroit Lions \\ NFL", "Public domain", ""], // Dick "Night Train" Lane
  "xwilliebrown": ["xwilliebrown", "WillieBrown.jpg", "w:United States Navy photo by Mass Communication Specialist 1st Class James E. Foehl", "Public domain", ""], // Willie Brown
  "xmikehaynes": ["xmikehaynes", "MikeHaynesLA.png", "Unknown author Unknown author", "Public domain", ""], // Mike Haynes
  "xlembarney": ["xlembarney", "Lem_Barney_2015.jpg", "Renee530", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0"], // Lem Barney
  "xdarrellgreen": ["xdarrellgreen", "Darrell_Green_49ers_at_Redskins_2019_(48933295231)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0"], // Darrell Green
  "xkenhouston": ["xkenhouston", "KenHouston.png", "Glendale Stamps", "Public domain", ""], // Ken Houston
  "xlarrywilson": ["xlarrywilson", "LarryWilson.png", "Glendale Stamps", "Public domain", ""], // Larry Wilson
  "xpaulkrause": ["xpaulkrause", "PaulKrauseVikings.png", "Unknown author Unknown author", "Public domain", ""], // Paul Krause
  "xsteveatwater": ["xsteveatwater", "Steve_Atwater_(250130-M-LM126-1122)_(cropped).jpg", "Lance Cpl. Taylor Von Sanders-Frazer", "Public domain", ""], // Steve Atwater
  "xbriandawkins": ["xbriandawkins", "Brian_Dawkins_Philly_HOF_(cropped).jpg", "Bertolinephotos", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0"], // Brian Dawkins
  "xjanstenerud": ["xjanstenerud", "JanStenerud.jpg", "Larsonk at English Wikipedia", "Public domain", ""], // Jan Stenerud
  "xmortenandersen": ["xmortenandersen", "Morten_Andersen_at_NFL_Fan_Rally.jpg", "Samjudge. from UK", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"], // Morten Andersen
  "xlougroza": ["xlougroza", "Lou_Groza_1957.jpg", "Topps", "Public domain", ""], // Lou Groza
};
// </legend-photos>

/** A Legend's photo (p: his key), '' for none. */
export const legendUrl = p => (PHOTO[p] ? `img/dynasty/legends/${PHOTO[p][0]}.jpg` : '');
/** Its credit: {author, licence, licenceUrl, page (its Wikimedia Commons page)}, null for none. */
export function legendCredit(p) {
  const r = PHOTO[p];
  return r ? {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r[1])}`} : null;
}
