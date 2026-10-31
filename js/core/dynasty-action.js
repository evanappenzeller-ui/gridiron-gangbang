// Action photos on the Rare and better cards (the owner, Oct 31 2026: "Leave the headshot pictures for the common cards.
// For rare or higher, the photo should be an action photo of the player with a background color to match the team"):
// a freely licensed Wikimedia Commons photo of the player in uniform from his playing days (a game, a Pro Bowl, a
// practice, a period trading card), chosen by eye with tools/dynasty/action_photos.py, cropped round him and cut out
// (its background removed) to img/dynasty/action/<key>.webp, so the card's own team colours and graphic show behind him.
// Every Rare, Epic, Legendary or Mythic card of his wears it (core/dynasty.js setData: head 'a:<key>'), in place of a
// Live player's headshot or a Legend's lead photo; a Common card keeps its headshot. (It replaced the Oct 31 2026
// "90+ club" rule, which put the uncut photos on every card rated 90 or more.) Like the Legends' photos, his card up
// close credits the author, licence and Commons page, which the licences require.
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
  "xrandymoss": ["xrandymoss", "Randy-Moss_8-28-09_Patriots-vs-Redskins.jpg", "[2] from Baltimore, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2009], // Randy Moss
  "xwalterpayton": ["xwalterpayton", "1986_Jeno's_Pizza_-_12_-_Walter_Payton_(Walter_Payton_crop).jpg", "Jeno's", "Public domain", "", 1984], // Walter Payton
  "xcalvinjohnson": ["xcalvinjohnson", "Calvin_Johnson_(cropped).png", "Kevind810", "GFDL", "http://www.gnu.org/copyleft/fdl.html", 2012], // Calvin Johnson
  "xedreed": ["xedreed", "Ed_reed_ravens2012.jpg", "Maryland National Guard", "Public domain", "", 2012], // Ed Reed
  "xladainiantomli": ["xladainiantomli", "LT_Chargers.jpg", "Keith Allison", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2006], // LaDainian Tomlinson
  "xrobgronkowski": ["xrobgronkowski", "Rob_Gronkowski_2021_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Rob Gronkowski
  "xronnielott": ["xronnielott", "Ronnie_lott_big_portrait.jpg", "User Mullethair", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2013], // Ronnie Lott
  "xadamvinatieri": ["xadamvinatieri", "Rigoberto_Sanchez,_Adam_Vinatieri_(44679700592)_(cropped).jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2018], // Adam Vinatieri
  "xboblilly": ["xboblilly", "Bob_lilly_signed.jpg", "Unknown author Unknown author", "Public domain", "", 1961], // Bob Lilly
  "xbrettfavre": ["xbrettfavre", "19981213_36_Brett_Favre,_Lambeau_Field_Cropped.jpg", "David Wilson", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 1998], // Brett Favre
  "xdarrellerevis": ["xdarrellerevis", "Darrelle_Revis_2014.jpg", "Andrew Campbell", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2007], // Darrelle Revis
  "xdrewbrees": ["xdrewbrees", "New_Orleans_Saints_Quarterback,_Drew_Brees_(23262414434)_(cropped).jpg", "Tammy Anthony Baker from Louisiana", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2013], // Drew Brees
  "xericdickerson": ["xericdickerson", "1985_Police_Raiders-Rams_-_20_Eric_Dickerson_(crop).jpg", "KIIS Radio/Los Angeles Rams/Los Angeles County Sheriff's Department", "Public domain", "", 1984], // Eric Dickerson
  "xjjwatt": ["xjjwatt", "JJ_Watt_(cropped1).JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2012], // J.J. Watt
  "xlancealworth": ["xlancealworth", "Lance_Alworth_wr_(cropped).jpg", "Unknown author Unknown author", "Public domain", "", 1969], // Lance Alworth
  "xlarryallen": ["xlarryallen", "Larry_Allen_in_2007.jpg", "John Martinez Pavliga", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2007], // Larry Allen
  "xtonygonzalez": ["xtonygonzalez", "Pass-Interference-Chargers-vs-Chiefs-Nov-9-08.jpg", "Dirk Hansen . Cropped/edited by User:Blueag9 .", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // Tony Gonzalez
  "xtroypolamalu": ["xtroypolamalu", "Troy_Polamalu_2013_(cropped).jpg", "original: Paula Lively derivative: Diddykong1130", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2013], // Troy Polamalu
  "xadrianpeterson": ["xadrianpeterson", "Adrian_Peterson_Vikings.jpg", "Arvee5.0", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2012], // Adrian Peterson
  "xbrucematthews": ["xbrucematthews", "Bruce_Matthews_cropped.jpg", "Jerry Sherk ( talk )", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 1984], // Bruce Matthews
  "xchampbailey": ["xchampbailey", "Champ_Bailey_2010.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2010], // Champ Bailey
  "xcharleswoodson": ["xcharleswoodson", "Charles_Woodson_2014_2_(cropped).JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2014], // Charles Woodson
  "xdarrellgreen": ["xdarrellgreen", "Darrell_Green_8-4-02_020804-N-5086M-004.jpg", "Photographer’s Mate 2nd Class Greg Mitchell, USN", "Public domain", "", 2002], // Darrell Green
  "xfrantarkenton": ["xfrantarkenton", "Tarkenton_calling_vikings.jpg", "Unknown author Unknown author", "Public domain", "", 1978], // Fran Tarkenton
  "xjackham": ["xjackham", "JackHamPIT.png", "Unknown author Unknown author", "Public domain", "", 1982], // Jack Ham
  "xjuniorseau": ["xjuniorseau", "Junior_Seau_with_Patriots_side_view_cropped.jpg", "Junior_Seau_with_Patriots_side_view.jpg : Dave Sizer derivative work: Bagumba", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // Junior Seau
  "xmarvinharrison": ["xmarvinharrison", "Marvin_Harrison_in_2007_Training_Camp_2.jpg", "The original uploader was Djmunden at English Wikipedia .", "CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5", 2008], // Marvin Harrison
  "xraynitschke": ["xraynitschke", "Nitschke_packers.jpg", "Unknown author Unknown author", "Public domain", "", 1966], // Ray Nitschke
  "xterrellowens": ["xterrellowens", "Terrell-Owens-Aug302007-Vikings-Preseason.jpg", "suzismini . Cropped by User:Blueag9 .", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2007], // Terrell Owens
  "xwalterjones": ["xwalterjones", "Walter-Jones-2008-11-02-vsEagles.jpg", "Luis Antonio Rodríguez Ochoa from Redmond, Washington. Cropped by User:Blueag9 .", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2008], // Walter Jones
  "xbriandawkins": ["xbriandawkins", "Brian_Dawkins.JPG", "Jeffrey Beall", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", 2009], // Brian Dawkins
  "xcriscarter": ["xcriscarter", "CC_Pro_Bowl.JPG", "Justvikings ( talk ) ( Uploads )", "Public domain", "", 1999], // Cris Carter
  "xdanfouts": ["xdanfouts", "1986_Jeno's_Pizza_-_53_-_Dan_Fouts_and_Don_Macek_(Dan_Fouts_crop).jpg", "Jeno's", "Public domain", "", 1982], // Dan Fouts
  "xfrancoharris": ["xfrancoharris", "1986_Jeno's_Pizza_-_46_-_Terry_Bradshaw_(Franco_Harris_crop).jpg", "Jeno's", "Public domain", "", 1980], // Franco Harris
  "xjustintucker": ["xjustintucker", "Justin_Tucker_Ravens_Camp_AUG2022_(cropped).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2022], // Justin Tucker
  "xkellenwinslow": ["xkellenwinslow", "Kellen_Winslow_circa_1986.jpg", "Oscar Mayer", "Public domain", "", 1987], // Kellen Winslow
  "xkurtwarner": ["xkurtwarner", "Kurt_Warner_(2009_Pro_Bowl).jpg", "English: Sgt. Macario P. Mora Jr", "Public domain", "", 2009], // Kurt Warner
  "xpaulwarfield": ["xpaulwarfield", "Paul_Warfield_1971MIA.png", "Dell", "Public domain", "", 1971], // Paul Warfield
  "xterrybradshaw": ["xterrybradshaw", "1983_Steelers_Police_-_04_Terry_Bradshaw_(crop).jpg", "Pittsburgh Steelers/Coca-Cola/Kiwanis International", "Public domain", "", 1982], // Terry Bradshaw
  "xwillielanier": ["xwillielanier", "WillieLanierKC.png", "Hank Young", "Public domain", "", 1986], // Willie Lanier
  "xjackyoungblood": ["xjackyoungblood", "JackYoungbloodLA.png", "Unknown author Unknown author", "Public domain", "", 1980], // Jack Youngblood
  "xjanstenerud": ["xjanstenerud", "Jan_stenerud_chiefs_signed_photo.jpg", "Unknown", "Public domain", "", 1967], // Jan Stenerud
  "xjohnmackey": ["xjohnmackey", "John_mackey_press_photo_1972.jpg", "Unknown", "Public domain", "", 1972], // John Mackey
  "xkenhouston": ["xkenhouston", "KenHouston.png", "Glendale Stamps", "Public domain", "", 1969], // Ken Houston
  "xlennymoore": ["xlennymoore", "1956_topps_lenny_moore.jpg", "Unknown author Unknown author", "Public domain", "", 1956], // Lenny Moore
  "xpaulkrause": ["xpaulkrause", "1986_Jeno's_Pizza_-_18_-_Alan_Page_(Paul_Krause_crop).jpg", "Jeno's", "Public domain", "", 1977], // Paul Krause
  "xsamhuff": ["xsamhuff", "Sam_huff_redskins.jpg", "Unknown author Unknown author", "Public domain", "", 1964], // Sam Huff
  "xwarrenmoon": ["xwarrenmoon", "Warren_Moon_and_Mike_Rozier_1987.jpg", "Houston Oilers", "Public domain", "", 1987], // Warren Moon
  "xjohnriggins": ["xjohnriggins", "JohnRiggins1983TrainingCamp.jpg", "Ted Van Pelt", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2008], // John Riggins
  "0032726": ["0032726", "Ka'imi_Fairbairn_(45034655335)_(cropped).jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2018], // Ka'imi Fairbairn
  "0034857": ["0034857", "NFL2021_-_Washington_Football_Team_at._Buffalo_Bills_101_(51529124162).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Josh Allen
  "0037236": ["0037236", "Aidan_Hutchinson.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Aidan Hutchinson
  "0029592": ["0029592", "Kevin_Zeitler.JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2015], // Kevin Zeitler
  "0034973": ["0034973", "Maxx_Crosby_Las_Vegas_Raiders_2021_(cropped_1).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Maxx Crosby
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
  "0031279": ["0031279", "Jake_Matthews_&_Matt_Ryan_vs_WFT_2021_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Jake Matthews
  "0033132": ["0033132", "Jeffery_Simmons_&_Kevin_Byard_Oilers_Throwback_Jerseys.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2023], // Kevin Byard
  "0036358": ["0036358", "CeeDee_Lamb_Cowboys_(cropped).jpg", "AlexanderJonesi", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // CeeDee Lamb
  "0036564": ["0036564", "Hufanga_2025.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2025], // Talanoa Hufanga
  "0032071": ["0032071", "Trenton_Brown.JPG", "Jeffrey Beall", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2015], // Trent Brown
  "0034351": ["0034351", "Dallas_Goedert_(52510560186)_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Dallas Goedert
  "0034974": ["0034974", "Julian_Love_(cropped).jpg", "AlexanderJonesi", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2019], // Julian Love
  "0036223": ["0036223", "Jonathan_Taylor_Colts_OCT2022_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Jonathan Taylor
  "0036900": ["0036900", "Commanders_vs._Bengals_-_54752531474.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Ja'Marr Chase
  "0037238": ["0037238", "Drake_London_Falcons_camp_2022.png", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2022], // Drake London
  "0037244": ["0037244", "Devin_Lloyd_and_Logan_Thomas_2022_2.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Devin Lloyd
  "0039851": ["0039851", "Drake_Maye_Patriots_vs_Titans_NOV2024.png_(section)_(cropped).png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2024], // Drake Maye
  "0033288": ["0033288", "George_Kittle_DSC08082_(48940368597)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2019], // George Kittle
  "0034815": ["0034815", "Fred_Warner_49ers_2018_(cropped).jpg", "U.S. Air Force Airman 1st Class Jonathon D. A. Carnell", "Public domain", "", 2018], // Fred Warner
  "0035248": ["0035248", "Zach_Allen.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2025], // Zach Allen
  "0036409": ["0036409", "Jordyn_Brooks_(50744647202)_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Jordyn Brooks
  "0038552": ["0038552", "Riley_Moss_Broncos.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2025], // Riley Moss
  "0039064": ["0039064", "Ravens_Training_Camp_(53880447586).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2024], // Zay Flowers
  "0032378": ["0032378", "DeForest_Buckner.JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2016], // DeForest Buckner
  "0038124": ["0038124", "Pass_interference_-_Detroit_Lions_vs_Green_Bay_Packers_2022_Week_18.jpg", "CBS / Highlight Heaven", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2023], // Christian Watson
  "0031933": ["0031933", "Leonard_Williams_WSH_vs_NYG_OCT2023_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2023], // Leonard Williams
  "0032965": ["0032965", "Ronnie_Stanley_Ravens_Training_Camp_AUG2023_(cropped).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2023], // Ronnie Stanley
  "0035642": ["0035642", "Commanders_vs._Jaguars_(52377888202).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Josh Hines-Allen
  "0036410": ["0036410", "Commanders_vs._Bengals_-_54752649825.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tee Higgins
  "0036914": ["0036914", "Gregory_Rousseau_(51528386792)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Greg Rousseau
  "0039111": ["0039111", "Tuli_Tuipulotu.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tuli Tuipulotu
  "0039337": ["0039337", "Malik_Nabers_Giants_week_1_2025.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Malik Nabers
  "0038542": ["0038542", "2025_Commanders_at_Falcons_11.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Bijan Robinson
  "0036994": ["0036994", "Ernest_Jones_South_Carolina.jpg", "Gamecock Central", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2019], // Ernest Jones
  "0037192": ["0037192", "George_Karlaftis.jpg", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2022], // George Karlaftis
  "0037239": ["0037239", "IX8A4137_(45339431234)_(cropped).jpg", "Maize & Blue Nation", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Chris Olave
  "0038386": ["0038386", "Jalen_Carter.png", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2023], // Jalen Carter
  "0038560": ["0038560", "Jordan_Battle,_2021.jpg", "The University of Alabama", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2021], // Jordan Battle
  "0037840": ["0037840", "NFL_Playoff_Wildcard_Game_-_Kyren_Williams_Running_Back_Rams_(54266524948).jpg", "James Larrison from Scottsdale, AZ, USA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2025], // Kyren Williams
  "0039065": ["0039065", "SamLaPorta.jpg", "Maize & Blue Nation", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2021], // Sam LaPorta
  "0031492": ["0031492", "Jason_Myers_-_51720303739_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Jason Myers
  "0033106": ["0033106", "Jared_Goff_&_D'Andre_Swift_Commanders_vs_Lions_SEP2022_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Jared Goff
  "0033831": ["0033831", "Andrew_Wylie-1st_&_Goal-Chiefs_at_Buccaneers_(52402413344)_(cropped).jpg", "elisfkc2", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Andrew Wylie
  "0035272": ["0035272", "Andrew_Van_Ginkel_Dolphins-Falcons_OCT2021.png", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2021], // Andrew Van Ginkel
  "0036388": ["0036388", "Xavier_McKinney_WFT-NYG_JAN2022_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Xavier McKinney
  "0036554": ["0036554", "Nico_Collins_2019.jpg", "Maize & Blue Nation", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2019], // Nico Collins
  "0036986": ["0036986", "Nahshon_Wright.jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Nahshon Wright
  "0036997": ["0036997", "Javonte_Williams_2021_(51650645333)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Javonte Williams
  "0038038": ["0038038", "Kyle_Hamilton_Ravens_Training_Camp_AUG2023_(cropped).jpg", "Maryland GovPics", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2023], // Kyle Hamilton
  "0039018": ["0039018", "Jack_Campbell_Iowa_(cropped).jpg", "Maize & Blue Nation", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2022], // Jack Campbell
  "0040128": ["0040128", "Tyler_Warren_pro_bowl.png", "Tennessee Titans", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Tyler Warren
  "0032764": ["0032764", "Derrick_Henry_Titans_vs_Commanders_OCT2022.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Derrick Henry
  "0034158": ["0034158", "Brian_O'Neill_2020.png", "Atlanta Falcons", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2020], // Brian O'Neill
  "0035358": ["0035358", "Chase_McLaughlin_(51402814375)_(cropped).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2021], // Chase McLaughlin
  "0036418": ["0036418", "ZackBaunUW2018_(cropped).jpg", "https://www.sportsnet.ca/wp-content/uploads/2025/03/Zack-Baun-768x432.jpg", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Zack Baun
  "0036442": ["0036442", "Commanders_vs._Bengals_-_54751463192.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Joe Burrow
  "0036912": ["0036912", "Devonta_Smith_2022_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // DeVonta Smith
  "0037240": ["0037240", "Jameson_Williams.png", "The University of Alabama", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2021], // Jameson Williams
  "0038996": ["0038996", "2025_Commanders_at_Packers_77.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tucker Kraft
  "0039852": ["0039852", "Jared_Verse_(cropped).jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Jared Verse
  "0039888": ["0039888", "Quinyon_Mitchell_Toledo_Rockets_Football,_December_2023.jpg", "MrJacon000", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2023], // Quinyon Mitchell
  "0040122": ["0040122", "2025_Raiders_at_Commanders_106.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Ashton Jeanty
  "0033131": ["0033131", "Maliek_Collins.jpg", "Keith Allison from Hanover, MD, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2017], // Maliek Collins
  "0036220": ["0036220", "Derrick_Brown_(American_football).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Derrick Brown
  "0037692": ["0037692", "Brandon_Aubrey_10_1_2023.jpg", "Time2Football", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2023], // Brandon Aubrey
  "0039838": ["0039838", "Calen_Bullock_pro_bowl.png", "Tennessee Titans", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Calen Bullock
  "0039860": ["0039860", "Kool-Aid_McKinstry_2021.jpg", "The University of Alabama", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2021], // Kool-Aid McKinstry
  "0031364": ["0031364", "Jadeveon_Clowney_vs_Redskins_2018.jpg", "Keith Allison: Flickr , e-mail , Twitter , Instagram , website", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2018], // Jadeveon Clowney
  "0031898": ["0031898", "Alex_Singleton_1_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Alex Singleton
  "0034429": ["0034429", "Jordan_Mailata.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Jordan Mailata
  "0034495": ["0034495", "Evan_Brown_(52379162989)_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Evan Brown
  "0034668": ["0034668", "Aaron_Stinnie_2018_08-09.jpg", "Chipermc", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2018], // Aaron Stinnie
  "0034675": ["0034675", "Jessie_Bates_III_(31015688557)_(cropped).jpg", "Office of the Maryland Governor on Flickr", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Jessie Bates
  "0034759": ["0034759", "Kolton_Miller_2025.jpg", "All-Pro Reels", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Kolton Miller
  "0034856": ["0034856", "Denzel_Ward_(cropped).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2018], // Denzel Ward
  "0035230": ["0035230", "Ed_Oliver_2021_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Ed Oliver
  "0035261": ["0035261", "Tony_Pollard_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2019], // Tony Pollard
  "0035687": ["0035687", "Bobby_Okereke_(7370935)_(cropped).jpg", "Photo by Sgt. Jonah Alvarez", "Public domain", "", 2022], // Bobby Okereke
  "0036971": ["0036971", "Trevor_Lawrence_vs_Commanders_2022_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Trevor Lawrence
  "0036974": ["0036974", "Tyson_Campbell_(cropped).jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Tyson Campbell
  "0037228": ["0037228", "Jaylen_Warren_Cropped.jpg", "Cramerwiki", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", 2024], // Jaylen Warren
  "0037250": ["0037250", "Martin_Emerson_(52340507131)_(cropped).jpg", "Erik Drost", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2022], // Martin Emerson
  "0038563": ["0038563", "Tre_Tucker_(54841331175)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Tre Tucker
  "0039067": ["0039067", "Rashee_Rice_(55090108907)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2026], // Rashee Rice
  "0039491": ["0039491", "Jalen_Coker.jpg", "Nathan Clinebelle", "Public domain", "", 2026], // Jalen Coker
  "0040579": ["0040579", "Carson_Schwesinger_2025_Browns_Camp_(cropped).jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2025], // Carson Schwesinger
  "0041528": ["0041528", "Michael_Taaffe.jpg", "Maize & Blue Nation", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2024], // Michael Taaffe
  "0032762": ["0032762", "Chris_Jones_(defensive_tackle,_born_1994).JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2017], // Chris Jones
  "0033890": ["0033890", "Budda_Baker.JPG", "Jeffrey Beall", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2017], // Budda Baker
  "0034768": ["0034768", "Chukwuma_Okorafor_(50695534763)_(cropped).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Chukwuma Okorafor
  "0034836": ["0034836", "Braden_Smith_at_Lambeau_Field.jpg", "Jhansen23", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2024], // Braden Smith
  "0035676": ["0035676", "Aj_brown_titans_vs_browns.png", "Tennessee Titans", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0", 2020], // A.J. Brown
  "0036322": ["0036322", "Jefferson_2022.jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2022], // Justin Jefferson
  "0039172": ["0039172", "Jake_Bates_(53752265654)_(cropped).jpg", "2C2K Photography from Houston, TX, USA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", 2024], // Jake Bates
  "0039918": ["0039918", "Commanders_vs._Bears_(54857809842).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", 2025], // Caleb Williams
  "0040663": ["0040663", "Harold_Fannin_Jr._2026_Cleveland_Browns_training_camp_(cropped).jpg", "Erik Drost", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", 2026], // Harold Fannin Jr.
  "0034796": ["0034796", "Lamar_Jackson_passing_2020_(cropped).jpg", "All-Pro Reels", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2020], // Lamar Jackson
  "0039163": ["0039163", "CJ_Stroud_in_2026.jpg", "Jumpingmpjopa", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", 2026], // C.J. Stroud
  "0023459": ["0023459", "AaronRodgersSteelers_(cropped).jpg", "Cramerwiki", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", 2025], // Aaron Rodgers
  "0033873": ["0033873", "Patrick_Mahomes_on_the_run_(51616124184).jpg", "All-Pro Reels from District of Columbia, USA", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", 2021], // Patrick Mahomes
};
// </action-photos>

/** A player's action photo, cut out (p: his key), '' for none. */
export const actionUrl = p => (ACTION[p] ? `img/dynasty/action/${ACTION[p][0]}.webp` : '');
/** Its credit: {author, licence, licenceUrl, page (its Wikimedia Commons page), year}, null for none. */
export function actionCredit(p) {
  const r = ACTION[p];
  return r ? {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r[1])}`, year: r[5] || 0} : null;
}
