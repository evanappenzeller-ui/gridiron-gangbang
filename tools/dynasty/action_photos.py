#!/usr/bin/env python3
"""Playing-days photos on the 90+ cards (the owner, Oct 31 2026: "The pictures being used for the legend players are too
formal ... for any players that are in the 90+ overall club. Find photos of them playing or some sort of playing card
design"): a freely licensed Wikimedia Commons photo of each such player in uniform, from his playing days (a game, a Pro
Bowl, a practice, a period trading card or team handout), on every card of his rated 90 or more, in place of the
Legends' Wikipedia lead photos (core/dynasty-legends.js, often a suit at an awards night) and the Live headshots.

  python3 tools/dynasty/action_photos.py find   # every 90+ player's candidates -> .cache/action/candidates.json and
                                                # contact sheets (sheet-NN.jpg) to choose from by eye
  python3 tools/dynasty/action_photos.py build  # PICK -> img/dynasty/action/<key>.jpg (600 x 450) and the ACTION table
                                                # in js/core/dynasty-action.js (between its <action-photos> marks)
Then bump CACHE in sw.js.

Reads Commons' and Wikipedia's ordinary pages (not the API, which rate-limits shared addresses) and the thumbnails on
upload.wikimedia.org. PICK is chosen by eye from the contact sheets: a photo is only picked when it is our player, in
uniform (or on his period card), and he is clear in the crop; CROP sets the crop by hand where the face finder misses.
A player without a pick keeps his portrait (a Legend's lead photo, else his number; a Live player's headshot).
"""
import hashlib, html, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from legend_photos import TITLE, faces, slug, plain  # noqa: E402

sys.dont_write_bytecode = True
DATA = os.path.join(ROOT, 'data', 'dynasty.json')
IMG = os.path.join(ROOT, 'img', 'dynasty', 'action')
JS = os.path.join(ROOT, 'js', 'core', 'dynasty-action.js')
CACHE = os.path.join(ROOT, 'tools', 'dynasty', '.cache', 'action')
UA = 'GridironRivalsActionPhotos/1.0 (https://github.com/evanappenzeller-ui/gridiron-gangbang)'
CLUB = 90       # the 90+ club: a card rated this or more
W, H = 600, 660  # the card's picture window (a little taller than wide)
SEASON = 2026   # this season (a Live player's first season: SEASON - his years in the league)

# player key -> the Commons file chosen by eye (its name as the file page has it, without "File:")
PICK = {
    "xjerryrice": "Jerry_Rice_1985.jpg",  # Jerry Rice, 1985
    "xlawrencetaylor": "Lawrence_Taylor_tackle.jpg",  # Lawrence Taylor, 1984
    "xtombrady": "Tom_Brady_WFT-Buccaneers_NOV2021_(cropped).jpg",  # Tom Brady, 2021
    "xjimbrown": "Jim_Brown_1959_Topps_cropped_and_recoloured.jpg",  # Jim Brown, 1959
    "xpeytonmanning": "Manning_cropped.jpg",  # Peyton Manning, 2008
    "xreggiewhite": "19981213_28_Reggie_White,_Lambeau_Field_(cropped).jpg",  # Reggie White, 1998
    "xaarondonald": "Aaron_Donald_2020_(cropped).jpg",  # Aaron Donald, 2020
    "xjoemontana": "1986_Jeno's_Pizza_-_28_-_Roger_Craig_(Joe_Montana_crop).jpg",  # Joe Montana, 1985
    "xjohnnyunitas": "1958_topps_johnny_unitas.jpg",  # Johnny Unitas, 1958
    "xrandymoss": "Randy-Moss_8-28-09_Patriots-vs-Redskins.jpg",  # Randy Moss, 2009
    "xraylewis": "Ray-Lewis-2008-Steelers-regseason-game.jpg",  # Ray Lewis, 2008
    "xwalterpayton": "1986_Jeno's_Pizza_-_12_-_Walter_Payton_(Walter_Payton_crop).jpg",  # Walter Payton, 1984
    "xcalvinjohnson": "Calvin_Johnson_(cropped).png",  # Calvin Johnson, 2012
    "xdeaconjones": "Deacon_Jones.png",  # Deacon Jones, 1972
    "xedreed": "Ed_reed_ravens2012.jpg",  # Ed Reed, 2012
    "xgalesayers": "Gale_sayers_playing.jpg",  # Gale Sayers, 1972
    "xjoegreene": "Mean_Joe_Greene_1975.JPG",  # Joe Greene, 1975
    "xladainiantomli": "LT_Chargers.jpg",  # LaDainian Tomlinson, 2006
    "xrobgronkowski": "Rob_Gronkowski_2021_(cropped).jpg",  # Rob Gronkowski, 2021
    "xronnielott": "Ronnie_lott_big_portrait.jpg",  # Ronnie Lott, 2013
    "xadamvinatieri": "Rigoberto_Sanchez,_Adam_Vinatieri_(44679700592)_(cropped).jpg",  # Adam Vinatieri, 2018
    "xboblilly": "Bob_lilly_signed.jpg",  # Bob Lilly, 1961
    "xbrettfavre": "19981213_36_Brett_Favre,_Lambeau_Field_Cropped.jpg",  # Brett Favre, 1998
    "xdarrellerevis": "Darrelle_Revis_2014.jpg",  # Darrelle Revis, 2007
    "xdicknighttrain": "Dick_Lane_1962.JPG",  # Dick "Night Train" Lane, 2014
    "xdrewbrees": "New_Orleans_Saints_Quarterback,_Drew_Brees_(23262414434)_(cropped).jpg",  # Drew Brees, 2013
    "xericdickerson": "1985_Police_Raiders-Rams_-_20_Eric_Dickerson_(crop).jpg",  # Eric Dickerson, 1984
    "xjacklambert": "Jack_Lambert_in_December_1975.JPG",  # Jack Lambert, 1975
    "xjjwatt": "JJ_Watt_(cropped1).JPG",  # J.J. Watt, 2012
    "xlancealworth": "Lance_Alworth_wr_(cropped).jpg",  # Lance Alworth, 1969
    "xlarryallen": "Larry_Allen_in_2007.jpg",  # Larry Allen, 2007
    "xrogerstaubach": "Staubach_cowboys_qb.jpg",  # Roger Staubach, 1976
    "xtonygonzalez": "Pass-Interference-Chargers-vs-Chiefs-Nov-9-08.jpg",  # Tony Gonzalez, 2008
    "xtroypolamalu": "Troy_Polamalu_2013_(cropped).jpg",  # Troy Polamalu, 2013
    "xadrianpeterson": "Adrian_Peterson_Vikings.jpg",  # Adrian Peterson, 2012
    "xalanpage": "1986_Jeno's_Pizza_-_18_-_Alan_Page_(Alan_Page_crop).jpg",  # Alan Page, 1977
    "xbartstarr": "Bart_Starr_1958.jpg",  # Bart Starr, 1958
    "xbrucematthews": "Bruce_Matthews_cropped.jpg",  # Bruce Matthews, 1984
    "xchampbailey": "Champ_Bailey_2010.JPG",  # Champ Bailey, 2010
    "xcharleswoodson": "Charles_Woodson_2014_2_(cropped).JPG",  # Charles Woodson, 2014
    "xchuckbednarik": "ChuckBednarik1952Bowman.jpg",  # Chuck Bednarik, 1952
    "xdarrellgreen": "Darrell_Green_8-4-02_020804-N-5086M-004.jpg",  # Darrell Green, 2002
    "xfrantarkenton": "Tarkenton_calling_vikings.jpg",  # Fran Tarkenton, 1978
    "xginomarchetti": "Gino_Marchetti_1961.jpg",  # Gino Marchetti, 1961
    "xjackham": "JackHamPIT.png",  # Jack Ham, 1982
    "xjimparker": "Parker-Jim-1960.jpg",  # Jim Parker, ?
    "xjoenamath": "1986_Jeno's_Pizza_-_37_-_Joe_Namath_(Joe_Namath_crop).jpg",  # Joe Namath, 1969
    "xjuniorseau": "Junior_Seau_with_Patriots_side_view_cropped.jpg",  # Junior Seau, 2008
    "xmarvinharrison": "Marvin_Harrison_in_2007_Training_Camp_2.jpg",  # Marvin Harrison, 2008
    "xmerlinolsen": "Merlin_Olsen.png",  # Merlin Olsen, 1971
    "xraymondberry": "Berry_1961_Topps.jpg",  # Raymond Berry, 1961
    "xraynitschke": "Nitschke_packers.jpg",  # Ray Nitschke, 1966
    "xstevelargent": "SteveLargent.png",  # Steve Largent, 1985
    "xterrellowens": "Terrell-Owens-Aug302007-Vikings-Preseason.jpg",  # Terrell Owens, 2007
    "xwalterjones": "Walter-Jones-2008-11-02-vsEagles.jpg",  # Walter Jones, 2008
    "xbriandawkins": "Brian_Dawkins.JPG",  # Brian Dawkins, 2009
    "xcriscarter": "CC_Pro_Bowl.JPG",  # Cris Carter, 1999
    "xdanfouts": "1986_Jeno's_Pizza_-_53_-_Dan_Fouts_and_Don_Macek_(Dan_Fouts_crop).jpg",  # Dan Fouts, 1982
    "xderrickbrooks": "Dbrooks_03_(cropped).jpg",  # Derrick Brooks, 2003
    "xforrestgregg": "ForrestGreggGB.png",  # Forrest Gregg, 1963
    "xfrancoharris": "1986_Jeno's_Pizza_-_46_-_Terry_Bradshaw_(Franco_Harris_crop).jpg",  # Franco Harris, 1980
    "xjustintucker": "Justin_Tucker_Ravens_Camp_AUG2022_(cropped).jpg",  # Justin Tucker, 2022
    "xkellenwinslow": "Kellen_Winslow_circa_1986.jpg",  # Kellen Winslow, 1987
    "xkurtwarner": "Kurt_Warner_(2009_Pro_Bowl).jpg",  # Kurt Warner, 2009
    "xlougroza": "Lou_Groza_1957.jpg",  # Lou Groza, 1957
    "xmarcusallen": "1985_Police_Raiders-Rams_-_01_Marcus_Allen_(crop).jpg",  # Marcus Allen, 1984
    "xpaulwarfield": "Paul_Warfield_1971MIA.png",  # Paul Warfield, 1971
    "xterrybradshaw": "1983_Steelers_Police_-_04_Terry_Bradshaw_(crop).jpg",  # Terry Bradshaw, 1982
    "xwillielanier": "WillieLanierKC.png",  # Willie Lanier, 1986
    "xbuckbuchanan": "BuckBuchananKC.png",  # Buck Buchanan, 1965
    "xdonmaynard": "Don_Maynard_1963_(cropped).jpg",  # Don Maynard, 1963
    "xemlentunnell": "Emlen_Tunnell_1954_Bowman.jpg",  # Emlen Tunnell, 1954
    "xjackyoungblood": "JackYoungbloodLA.png",  # Jack Youngblood, 1980
    "xjanstenerud": "Jan_stenerud_chiefs_signed_photo.jpg",  # Jan Stenerud, 1967
    "xjohnmackey": "John_mackey_press_photo_1972.jpg",  # John Mackey, 1972
    "xkenhouston": "KenHouston.png",  # Ken Houston, 1969
    "xlarrywilson": "LarryWilson.png",  # Larry Wilson, 1969
    "xlembarney": "LemBarneyDET.png",  # Lem Barney, 1968
    "xlendawson": "Kansas_City_Chiefs_at_Denver_Broncos_1985-12-14_(ticket)_(crop).jpg",  # Len Dawson, 1970
    "xlennymoore": "1956_topps_lenny_moore.jpg",  # Lenny Moore, 1956
    "xmikeditka": "Mike_ditka_topps_card_cropped.jpg",  # Mike Ditka, 1963
    "xpaulkrause": "1986_Jeno's_Pizza_-_18_-_Alan_Page_(Paul_Krause_crop).jpg",  # Paul Krause, 1977
    "xsamhuff": "Sam_huff_redskins.jpg",  # Sam Huff, 1964
    "xsonnyjurgensen": "1958_topps_sonny_jurgensen.jpg",  # Sonny Jurgensen, 1958
    "xwarrenmoon": "Warren_Moon_and_Mike_Rozier_1987.jpg",  # Warren Moon, 1987
    "xjohnriggins": "JohnRiggins1983TrainingCamp.jpg",  # John Riggins, 2008
    "0027857": "Trent_Willams_2020_(cropped).jpg",  # Trent Williams, 2020
    "0032726": "Ka'imi_Fairbairn_(45034655335)_(cropped).jpg",  # Ka'imi Fairbairn, 2018
    "0034857": "NFL2021_-_Washington_Football_Team_at._Buffalo_Bills_101_(51529124162).jpg",  # Josh Allen, 2021
    "0037236": "Aidan_Hutchinson.jpg",  # Aidan Hutchinson, 2022
    "0037841": "2025_Rams_vs_Titans_Quentin_Lake.png",  # Quentin Lake, 2025
    "0029592": "Kevin_Zeitler.JPG",  # Kevin Zeitler, 2015
    "0034973": "Maxx_Crosby_Las_Vegas_Raiders_2021_(cropped_1).jpg",  # Maxx Crosby, 2021
    "0030097": "David_Quessenberry_2021_09-19.jpg",  # David Quessenberry, 2021
    "0033886": "TJWatt2025.jpg",  # T.J. Watt, 2025
    "0035643": "2026_Tennessee_Titans_New_Jersey_Photo_Shoot_-_Jeffery_Simmons_(cropped).png",  # Jeffery Simmons, 2026
    "0035699": "Steelers_vs_Bucs_10.18.2026_2_(cropped).jpg",  # Jamel Dean, 2026
    "0039075": "Nacua_731_(cropped_2).jpg",  # Puka Nacua, 2023
    "0033280": "Christian_McCaffrey.png",  # Christian McCaffrey, 2019
    "0036963": "Amon-Ra_St._Brown_vs._Commanders_2022_(cropped).jpg",  # Amon-Ra St. Brown, 2022
    "0039338": "Brock_Bowers_(2025).jpg",  # Brock Bowers, 2025
    "0026498": "2025_Rams_vs_Titans_Matthew_Stafford_(cropped).png",  # Matthew Stafford, 2025
    "0031565": "Danielle_Hunter.JPG",  # Danielle Hunter, 2015
    "0037248": "JamesCookProBowl2024_(cropped).jpg",  # James Cook, 2024
    "0037834": "Brock_Purdy_injury_49ers_Bears_2024.jpg",  # Brock Purdy, 2024
    "0030561": "Eagles_at_Redskins_2017.jpg",  # Lane Johnson, 2017
    "0031279": "Jake_Matthews_&_Matt_Ryan_vs_WFT_2021_(cropped).jpg",  # Jake Matthews, 2021
    "0033132": "Jeffery_Simmons_&_Kevin_Byard_Oilers_Throwback_Jerseys.png",  # Kevin Byard, 2023
    "0036358": "CeeDee_Lamb_Cowboys_(cropped).jpg",  # CeeDee Lamb, 2020
    "0036564": "Hufanga_2025.png",  # Talanoa Hufanga, 2025
    "0031330": "NFL_2020_-_Playoffs_-_Washington_vs._Buccaneers_209_(50833182757).jpg",  # Morgan Moses, 2021
    "0032071": "Trenton_Brown.JPG",  # Trent Brown, 2015
    "0034351": "Dallas_Goedert_(52510560186)_(cropped).jpg",  # Dallas Goedert, 2022
    "0034974": "Julian_Love_(cropped).jpg",  # Julian Love, 2019
    "0036223": "Jonathan_Taylor_Colts_OCT2022_(cropped).jpg",  # Jonathan Taylor, 2022
    "0036900": "Commanders_vs._Bengals_-_54752531474.jpg",  # Ja'Marr Chase, 2025
    "0037238": "Drake_London_Falcons_camp_2022.png",  # Drake London, 2022
    "0037244": "Devin_Lloyd_and_Logan_Thomas_2022_2.jpg",  # Devin Lloyd, 2022
    "0039851": "Drake_Maye_Patriots_vs_Titans_NOV2024.png_(section)_(cropped).png",  # Drake Maye, 2024
    "0032234": "Laken_Tomlinson_with_49ers.jpg",  # Laken Tomlinson, 2017
    "0032391": "Joe_Thuney.JPG",  # Joe Thuney, 2017
    "0032445": "Ted_Karras_(offensive_lineman).JPG",  # Ted Karras, 2016
    "0033288": "George_Kittle_DSC08082_(48940368597)_(cropped).jpg",  # George Kittle, 2019
    "0034815": "Fred_Warner_49ers_2018_(cropped).jpg",  # Fred Warner, 2018
    "0035248": "Zach_Allen.png",  # Zach Allen, 2025
    "0036409": "Jordyn_Brooks_(50744647202)_(cropped).jpg",  # Jordyn Brooks, 2020
    "0038552": "Riley_Moss_Broncos.png",  # Riley Moss, 2025
    "0039064": "Ravens_Training_Camp_(53880447586).jpg",  # Zay Flowers, 2024
    "0032378": "DeForest_Buckner.JPG",  # DeForest Buckner, 2016
    "0033281": "Marlon_Humphrey_Baltimore_Ravens_2021_(cropped).jpg",  # Marlon Humphrey, 2021
    "0037191": "Washington_Commanders_at_Kansas_City_Chiefs_(55091195803).jpg",  # Trent McDuffie, 2026
    "0038124": "Pass_interference_-_Detroit_Lions_vs_Green_Bay_Packers_2022_Week_18.jpg",  # Christian Watson, 2023
    "0039813": "Evan_Williams_(safety).jpg",  # Evan Williams, 2025
    "0031933": "Leonard_Williams_WSH_vs_NYG_OCT2023_(cropped).jpg",  # Leonard Williams, 2023
    "0032965": "Ronnie_Stanley_Ravens_Training_Camp_AUG2023_(cropped).jpg",  # Ronnie Stanley, 2023
    "0033082": "Lucas_Patrick_(Green_Bay_Packers_player)_during_pre-season_game_against_Washington_Redskins_on_August_19,_2017_in_Maryland.jpg",  # Lucas Patrick, 2017
    "0035642": "Commanders_vs._Jaguars_(52377888202).jpg",  # Josh Hines-Allen, 2022
    "0036410": "Commanders_vs._Bengals_-_54752649825.jpg",  # Tee Higgins, 2025
    "0036914": "Gregory_Rousseau_(51528386792)_(cropped).jpg",  # Greg Rousseau, 2021
    "0039111": "Tuli_Tuipulotu.jpg",  # Tuli Tuipulotu, 2025
    "0039337": "Malik_Nabers_Giants_week_1_2025.jpg",  # Malik Nabers, 2025
}
# player key -> (centre x, top, height) as fractions of the photo's width and height
CROP = {
    "xlawrencetaylor": (0.55, 0.2, 0.6),  # Lawrence Taylor
    "xpeytonmanning": (0.62, 0, 0.9),  # Peyton Manning
    "xreggiewhite": (0.5, 0, 1),  # Reggie White
    "xgalesayers": (0.5, 0.08, 0.7),  # Gale Sayers
    "xbrettfavre": (0.5, 0.08, 0.55),  # Brett Favre
    "xdarrellerevis": (0.5, 0, 1),  # Darrelle Revis
    "xdarrellgreen": (0.5, 0, 0.7),  # Darrell Green
    "xwarrenmoon": (0.25, 0, 1),  # Warren Moon
    "0034857": (0.55, 0.12, 0.5),  # Josh Allen
    "0037841": (0.5, 0, 0.55),  # Quentin Lake
    "0030561": (0.6, 0.08, 0.75),  # Lane Johnson
    "0031279": (0.17, 0.02, 0.8),  # Jake Matthews
    "0033132": (0.8, 0.12, 0.4),  # Kevin Byard
    "0032071": (0.5, 0, 0.85),  # Trent Brown
    "0037244": (0.3, 0, 1),  # Devin Lloyd
    "0036409": (0.5, 0.02, 0.55),  # Jordyn Brooks
    "0039064": (0.2, 0, 1),  # Zay Flowers
    "0037191": (0.72, 0.06, 0.55),  # Trent McDuffie
    "0038124": (0.48, 0.15, 0.6),  # Christian Watson
    "0035642": (0.15, 0.12, 0.55),  # Josh Hines-Allen
    "0039337": (0.45, 0.04, 0.5),  # Malik Nabers
    "0037834": (0.55, 0, 0.55),  # Brock Purdy
}

POS = {'QB': ['quarterback'], 'RB': ['running back'], 'WR': ['wide receiver'], 'TE': ['tight end'], 'K': ['placekicker', 'kicker'],
       'OL': ['offensive lineman', 'offensive tackle', 'guard', 'center'], 'DL': ['defensive end', 'defensive tackle', 'defensive lineman'],
       'LB': ['linebacker'], 'CB': ['cornerback'], 'S': ['safety']}
GOOD = r'\bvs\.?\b|\bv\.? |versus|\bgame\b|\bweek ?\d|pro bowl|super bowl|training camp|practice|minicamp|preseason|season|playoff|' \
       r'touchdown|rush|pass|tackle|sack|kick|catch|warm|sideline|helmet|uniform|jersey|topps|bowman|fleer|\bcard\b|kahn|jeno|' \
       r'program|media guide|stadium|field'
BAD = r'hall of fame|\bhof\b|enshrine|induct|white house|obama|trump|biden|bush|clinton|reagan|president|award|espys|premiere|' \
      r'red carpet|signing|autograph|\bvisit|rally|gala|ceremony|statue|mural|bust\b|grave|funeral|wedding|laureus|derby|' \
      r'celebrity|golf|senate|congress|campaign|convention|interview|broadcast|studio|podcast|book|festival|concert|' \
      r'charity|fundrais|military|troops|base\b|navy|army|air force|marine|uso\b|signature|logo|tour\b|\bstore\b'
COLLEGE_BOWLS = r'rose bowl|sugar bowl|orange bowl|fiesta bowl|cotton bowl|peach bowl|citrus bowl|ncaa|college|university|heisman'


def get(url):
    """A page's text (cached), waiting out a rate limit."""
    os.makedirs(CACHE, exist_ok=True)
    keep = os.path.join(CACHE, 'p-' + hashlib.sha1(url.encode()).hexdigest()[:20] + '.html')
    if os.path.exists(keep):
        return open(keep, encoding='utf-8').read()
    for n in range(10):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                t = r.read().decode('utf-8', 'replace')
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                t = ''
                break
            if e.code != 429 or n == 9:
                raise
        except (urllib.error.URLError, TimeoutError):
            if n == 9:
                raise
        time.sleep(10 * (n + 1))
    open(keep, 'w', encoding='utf-8').write(t)
    time.sleep(.5)
    return t


def fetch(url, path):
    if os.path.exists(path):
        return True
    for n in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                data = r.read()
            open(path, 'wb').write(data)
            time.sleep(.5)
            return True
        except urllib.error.HTTPError as e:
            if e.code != 429:
                print('  !', e.code, url, file=sys.stderr)
                return False
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(3 * (n + 1))
    print('  ! gave up', url, file=sys.stderr)
    return False


def thumb(name, width):
    """A Commons file's picture at width (at most its own), from Commons' thumb.php (upload.wikimedia.org rate-limits
    shared addresses harder)."""
    return 'https://commons.wikimedia.org/w/thumb.php?' + urllib.parse.urlencode({'f': name, 'w': width})


def text(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def years(s):
    return [int(y) for y in re.findall(r'(?<!\d)(1[89]\d\d|20[0-3]\d)(?!\d)', s or '')]


def club():
    """The 90+ players: [(key, name, team name, pos, college, (first season, last season))]."""
    d = json.load(open(DATA, encoding='utf-8'))
    best, span = {}, {}
    for c in d['cards']:
        if c[3] >= CLUB:
            best[c[2]] = max(best.get(c[2], 0), c[3])
            if c[1] == 'X' and c[5]:
                y = years(re.sub(r'[–-](\d\d)\b', lambda m: '–' + c[5][0][:2] + m.group(1), c[5][0]))
                if y:
                    span[c[2]] = (min(y), max(y))
    out = []
    for k in sorted(best, key=lambda k: (not k.startswith('x'), -best[k], k)):
        pl = d['players'][k]
        sp = span.get(k) or (SEASON - (pl[5] or 0), SEASON)
        out.append((k, pl[0], d['teams'].get(pl[1], [pl[1]])[0], pl[2], pl[6] or '', sp))
    return out, d['teams']


def article(name, pos, college, legend):
    """His Wikipedia article's HTML ('' if not found)."""
    plain_name = re.sub(r'\s+', ' ', re.sub(r'"[^"]*"', '', name)).strip()
    tries = [TITLE[name]] if name in TITLE else []
    tries += [f'{plain_name} ({p})' for p in POS.get(pos, [])] + [f'{plain_name} (American football)', plain_name]
    for t in tries:
        h = get('https://en.wikipedia.org/wiki/' + urllib.parse.quote(t.replace(' ', '_')))
        if not h or 'may refer to' in h[:200000] and 'disambig' in h:
            continue
        if 'National Football League' in h and (legend or not college or college.split()[0] in h):
            return h
    return ''


def files_of(cat, depth, skip):
    """The files in a Commons category and (to depth) its subcategories."""
    h = get('https://commons.wikimedia.org/wiki/' + urllib.parse.quote(cat.replace(' ', '_')))
    if not h:
        return []
    a = h.find('id="mw-category-media"')
    found = [urllib.parse.unquote(f) for f in re.findall(r'href="/wiki/(File:[^"#?]+)"', h[a:] if a >= 0 else '')]
    if depth:
        s, e = h.find('id="mw-subcategories"'), h.find('id="mw-category-media"')
        for sub in dict.fromkeys(re.findall(r'href="/wiki/(Category:[^"#?]+)"', h[s:e] if s >= 0 else '')):
            sub = urllib.parse.unquote(sub)
            if not re.search(skip, sub, re.I):
                found += files_of(sub, depth - 1, skip)
    return list(dict.fromkeys(f[5:] for f in found))


def file_info(name):
    """A Commons file's credit and description, from its page."""
    h = get('https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(name.replace(' ', '_')))
    if not h:
        return None
    h = h.replace('&#95;', '_')

    def row(i):
        m = re.search(r'id="' + i + r'"[^>]*>.*?</td>\s*<td[^>]*>(.*?)</td>', h, re.S)
        return m.group(1) if m else ''
    date = row('fileinfotpl_date')
    m = re.search(r'datetime="(\d{4})', date)
    lic = re.search(r'class="licensetpl_short[^"]*"[^>]*>(.*?)</span>', h, re.S)
    link = re.search(r'class="licensetpl_link[^"]*"[^>]*>(.*?)</span>', h, re.S)
    size = re.search(r'([\d,]+) × ([\d,]+) pixels', h)
    cats = re.search(r'id="mw-normal-catlinks".*?</div>', h, re.S)
    return {'file': name.replace(' ', '_'), 'year': int(m.group(1)) if m else (years(text(date)) or [None])[0],
            'author': text(row('fileinfotpl_aut'))[:120] or 'Unknown author', 'licence': text(lic.group(1)) if lic else '',
            'licenceUrl': text(link.group(1)) if link and text(link.group(1)).startswith('http') else '', 'desc': text(row('fileinfotpl_desc'))[:300],
            'cats': text(cats.group(0)) if cats else '', 'w': int(size.group(1).replace(',', '')) if size else 0,
            'h': int(size.group(2).replace(',', '')) if size else 0}


def score(f, info, name, team, college, span, nick, searched=False):
    last = re.sub(r'\s+(Jr\.|Sr\.|III|II)$', '', re.sub(r'"[^"]*"', '', name)).split()[-1].lower()
    blob = ' '.join([f, (info or {}).get('desc', ''), (info or {}).get('cats', '')]).replace('_', ' ')
    s, why = 0, []
    if last not in blob.lower() and (info or not searched):
        s -= 4; why.append('name?')
    if 'cropped' in f.lower():
        s += 2; why.append('cropped')
    if re.search(GOOD, blob, re.I):
        s += 2; why.append('play')
    if re.search(BAD, blob, re.I):
        s -= 3; why.append('event')
    if re.search(COLLEGE_BOWLS, blob, re.I) or (college and len(college) > 3 and college.lower() in blob.lower()):
        s -= 2; why.append('college')
    if re.search(nick, blob, re.I):
        s += 2; why.append('team')
    if re.search(r'\.(svg|pdf|ogg|ogv|webm|tif|tiff|gif|mp3|wav)$', f, re.I):
        s -= 20
    if info:
        y = info['year']
        if y and span[0] - 1 <= y <= span[1]:
            s += 3; why.append(f'{y} in career')
        elif y and y > span[1]:
            s -= 4; why.append(f'{y} after')
        elif y and y < span[0] - 1:
            s -= 3; why.append(f'{y} before')
        if info['w'] and min(info['w'], info['h']) < 400:
            s -= 2; why.append('small')
    return s, why


def find():
    players, teams = club()
    nick = '|'.join(re.escape(v[0].split()[-1]) for v in teams.values()) + r'|Oilers|Redskins|Colts|Rams|Raiders|Chargers|Cardinals|Patriots|Football Team'
    out = []
    # (find 2/4: the second quarter of the club, so four can run at once; find <key> ...: just those players)
    part = re.fullmatch(r'(\d+)/(\d+)', sys.argv[2]) if len(sys.argv) > 2 else None
    only = set() if part else set(sys.argv[2:])
    name_of = 'candidates-%s-%s.json' % part.groups() if part else 'candidates-some.json' if only else 'candidates.json'
    for n, (key, name, team, pos, college, span) in enumerate(players):
        if only and key not in only or part and n % int(part.group(2)) != int(part.group(1)) - 1:
            continue
        legend = key.startswith('x')
        h = article(name, pos, college, legend)
        cats = [urllib.parse.unquote(c) for c in re.findall(r'commons\.wikimedia\.org/wiki/(Category:[^"#?&]+)', h)]
        plain_name = re.sub(r'\s+', ' ', re.sub(r'"[^"]*"', '', name)).strip()
        canon = re.search(r'<link rel="canonical" href="[^"]*/wiki/([^"#?]+)"', h)
        if not cats:
            cats = ['Category:' + urllib.parse.unquote(canon.group(1)).replace('_', ' ')] if canon else []
            cats += ['Category:' + plain_name]
        skip = r'college|university|high school|family|signature|statue|grave|' + (re.escape(college) if college else 'zzz')
        files = []
        for c in dict.fromkeys(cats[:2]):
            files += files_of(c, 1, skip)
        # the article's own pictures (its infobox and body), where Commons has no category for him
        files += [urllib.parse.unquote(f)[5:] for f in re.findall(r'href="/wiki/(File:[^"#?]+)"', h)]
        # Commons' search (it reads the descriptions too: a game's photos are often numbered, the players named inside)
        found = []
        for q in (f'"{plain_name}" {team.split()[-1]}', f'"{plain_name}" football'):
            r = get('https://commons.wikimedia.org/w/index.php?' + urllib.parse.urlencode({'search': q, 'ns6': '1', 'fulltext': '1', 'limit': '40'}))
            found += [urllib.parse.unquote(f)[5:].replace(' ', '_') for f in re.findall(r'href="/wiki/(File:[^"#?]+)"', r)]
        searched = set(found)
        files += found
        files = [f for f in dict.fromkeys(f.replace(' ', '_') for f in files)
                 if not re.search(r'\.(svg|pdf|ogg|ogv|webm|mp3|wav)$', f, re.I) and not re.search(r'logo|wordmark|icon|flag|map', f, re.I)]
        ranked = sorted(files, key=lambda f: -score(f, None, name, team, college, span, nick, f in searched)[0] - (f in searched))[:16]
        cands = []
        for f in ranked:
            i = file_info(f)
            if not i:
                continue
            s, why = score(f, i, name, team, college, span, nick)
            cands.append({**i, 'score': s, 'why': why})
        cands.sort(key=lambda c: -c['score'])
        out.append({'key': key, 'name': name, 'team': team, 'pos': pos, 'span': span, 'files': len(files), 'cands': cands[:6]})
        print(f'{name}: {len(files)} files, best {cands[0]["score"] if cands else "-"} {cands[0]["file"] if cands else ""}', file=sys.stderr)
        json.dump(out, open(os.path.join(CACHE, name_of), 'w'), indent=1)
    if not part:
        sheets(out)


def sheets(out):
    """Contact sheets: each player's best candidates in a row, numbered as candidates.json lists them."""
    from PIL import Image, ImageDraw
    from concurrent.futures import ThreadPoolExecutor
    th = os.path.join(CACHE, 'thumbs')
    os.makedirs(th, exist_ok=True)
    path = lambda c: os.path.join(th, hashlib.sha1(c['file'].encode()).hexdigest()[:16] + '.jpg')

    def one(c):
        return fetch(thumb(c['file'], min(330, c['w'] or 330)), path(c))
    with ThreadPoolExecutor(4) as pool:
        list(pool.map(one, [c for p in out for c in p['cands'][:5]]))
    rows = []
    for p in out:
        imgs = []
        for i, c in enumerate(p['cands'][:5]):
            try:
                im = Image.open(path(c)).convert('RGB')
            except Exception:
                im = None
            imgs.append((i, c, im))
        rows.append((p, imgs))
    for n in range(0, len(rows), 8):
        sheet = Image.new('RGB', (1500, 8 * 250), 'white')
        d = ImageDraw.Draw(sheet)
        for r, (p, imgs) in enumerate(rows[n:n + 8]):
            y = r * 250
            d.text((6, y + 4), f'{p["key"]}  {p["name"]}  {p["pos"]} {p["team"]}  {p["span"][0]}-{p["span"][1]}', fill='black')
            x = 6
            for i, c, im in imgs:
                if im:
                    im.thumbnail((280, 210))
                    sheet.paste(im, (x, y + 18))
                d.text((x, y + 230), f'{i}: {c.get("year")} s{c["score"]} {c["file"][:38]}', fill='black')
                x += 296
        sheet.save(os.path.join(CACHE, f'sheet-{n // 8:02d}.jpg'), quality=80)


def crop(src, out, hand=None):
    """A W x H crop of the player in action (hand's, else round the largest face with his shoulders and chest below it,
    else the photo's upper middle), saved as a JPEG."""
    from PIL import Image, ImageOps
    img = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    iw, ih = img.size
    f = [] if hand else faces(img)
    if hand:
        ch = min(ih, hand[2] * ih); cw = ch * W / H
        if cw > iw:
            cw = iw; ch = cw * H / W
        left, top = hand[0] * iw - cw / 2, hand[1] * ih
    elif f:
        x, y, w, h = f[0]
        ch = min(ih, max(h * 5, ih * .45)); cw = ch * W / H
        if cw > iw:
            cw = iw; ch = cw * H / W
        left, top = x + w / 2 - cw / 2, y + h / 2 - ch * .3
    else:
        ch = ih; cw = ch * W / H
        if cw > iw:
            cw = iw; ch = cw * H / W
        left, top = (iw - cw) / 2, 0
    left = max(0, min(left, iw - cw)); top = max(0, min(top, ih - ch))
    img.crop((round(left), round(top), round(left + cw), round(top + ch))).resize((W, H), Image.LANCZOS) \
        .save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    return bool(f)


def build():
    os.makedirs(IMG, exist_ok=True)
    players = {k: (name, span) for k, name, _, _, _, span in club()[0]}
    rows = []
    for key, f in PICK.items():
        if key not in players:
            print('not in the 90+ club:', key, file=sys.stderr)
            continue
        i = file_info(f.replace(' ', '_'))
        if not i or not i['licence']:
            print('no licence found:', key, f, file=sys.stderr)
            continue
        raw = os.path.join(CACHE, 'raw-' + slug(key) + '.jpg')
        if not fetch(thumb(i['file'], min(1280, i['w'] or 1280)), raw):
            continue
        crop(raw, os.path.join(IMG, slug(key) + '.jpg'), CROP.get(key))
        rows.append(f"  {json.dumps(key)}: {json.dumps([slug(key), i['file'], plain(i['author'])[:120], i['licence'], i['licenceUrl'], i['year'] or 0], ensure_ascii=False)}, // {players[key][0]}")
    keep = {slug(k) + '.jpg' for k in PICK}
    for old in os.listdir(IMG):
        if old not in keep:
            os.remove(os.path.join(IMG, old))
    js = open(JS, encoding='utf-8').read()
    a, b = js.index('// <action-photos>'), js.index('// </action-photos>')
    js = js[:a] + '// <action-photos> (written by tools/dynasty/action_photos.py)\nexport const ACTION = {\n' + '\n'.join(rows) + '\n};\n' + js[b:]
    open(JS, 'w', encoding='utf-8').write(js)
    print(f'{len(rows)} of {len(players)} players in the 90+ club have a playing-days photo', file=sys.stderr)


def merge():
    """The parts' candidates in the club's order -> candidates.json and the contact sheets."""
    order = [p[0] for p in club()[0]]
    got = {}
    for f in os.listdir(CACHE):
        if re.fullmatch(r'candidates-\d+-\d+\.json', f):
            got.update({p['key']: p for p in json.load(open(os.path.join(CACHE, f)))})
    out = [got[k] for k in order if k in got]
    json.dump(out, open(os.path.join(CACHE, 'candidates.json'), 'w'), indent=1)
    sheets(out)


if __name__ == '__main__':
    {'find': find, 'merge': merge, 'build': build}[sys.argv[1] if len(sys.argv) > 1 else 'find']()
