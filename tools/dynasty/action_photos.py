#!/usr/bin/env python3
"""Action photos on the Rare and better cards (the owner, Oct 31 2026: "Leave the headshot pictures for the common cards.
For rare or higher, the photo should be an action photo of the player with a background color to match the team"): a
freely licensed Wikimedia Commons photo of each player whose cards are Rare or better (a real trading card: core/
dynasty-real.js) in uniform from his playing days (a game, a Pro Bowl, a practice, a period trading card; a college game
where no NFL one is free), cut out so the card's team colours stand behind him. Common cards keep their headshots.

  python3 tools/dynasty/action_photos.py find [missing]  # each Rare+ player's candidates (missing: those without a PICK)
                                                         # -> .cache/action/candidates.json and contact sheets
                                                         # (sheet-NN.jpg) to choose from by eye; find 2/4 ...: a quarter
  python3 tools/dynasty/action_photos.py crops  # PICK -> the crops on contact sheets (.cache/action/crops-NN.jpg)
  python3 tools/dynasty/action_photos.py build  # PICK -> crop round him, cut out (rembg's BiRefNet portrait model; pip
                                                # install rembg scipy) -> img/dynasty/action/<key>.webp (600 x 660, alpha)
                                                # and the ACTION table in js/core/dynasty-action.js (its <action-photos>)
Then bump CACHE in sw.js. The crops and masks are kept in .cache/action, so a rebuild only cuts out what changed.

Reads Commons' and Wikipedia's ordinary pages (not the API, which rate-limits shared addresses) and the thumbnails on
upload.wikimedia.org. PICK is chosen by eye from the contact sheets: a photo is only picked when it is our player, in
uniform (or on his period card), and he is clear in the crop; CROP sets the crop by hand where the face finder misses
or another player stands against him. A player without a pick keeps his portrait (a Legend's lead photo, else his
number; a Live player's headshot).
"""
import hashlib, html, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from legend_photos import TITLE, faces, slug, plain  # noqa: E402

sys.dont_write_bytecode = True
DATA = os.path.join(ROOT, 'data', 'dynasty.json')
IMG = os.path.join(ROOT, 'img', 'dynasty', 'action')
JS = os.path.join(ROOT, 'js', 'core', 'dynasty-action.js')
REAL_JS = os.path.join(ROOT, 'js', 'core', 'dynasty-real.js')
CACHE = os.path.join(ROOT, 'tools', 'dynasty', '.cache', 'action')
UA = 'GridironRivalsActionPhotos/1.0 (https://github.com/evanappenzeller-ui/gridiron-gangbang)'
W, H = 600, 660  # the card's picture window (a little taller than wide)
S = 2           # the crop is cut out at twice the window's size
MODEL = 'birefnet-portrait'  # rembg's model for the cut-out's edge (pip install rembg; it downloads the model once)
SAM = 'sam'     # rembg's Segment Anything: keeps only our player where others touch him
REAL_IMG = os.path.join(ROOT, 'img', 'dynasty', 'real')
EDSR = 'https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x4.pb'  # 4x upscaling of the card scans
VERSION = 'v3'  # in the file names: a changed picture needs a new name (sw.js keeps pictures across releases)
# Players alone in their photo: BiRefNet's figure is kept whole, without Segment Anything (which can drop an arm or the ball)
ALONE = {'0034856', 'xbrettfavre', 'xjohnnyunitas', '0034790', '0036442', '0038542', 'xpeytonmanning'}  # Denzel Ward, Brett Favre, Johnny Unitas, Derwin James
# Segment Anything's prompt by hand, where another player overlaps ours (fractions of the crop): a box round him,
# points on him (1) and on the other (0), and boxes and outlines ('cut') to clear of what it still takes of the other
SAM_HINT = {
    '0037236': {'box': (.02, .03, .87, .93), 'points': [(.48, .1, 1), (.45, .3, 1), (.35, .55, 1), (.33, .82, 1), (.8, .2, 1),
                                                         (.08, .06, 1), (.16, .12, 1), (.25, .175, 1), (.33, .21, 1),
                                                         (.29, .11, 0), (.2, .35, 0), (.14, .42, 0), (.1, .7, 0), (.06, .9, 0),
                                                         (.78, .35, 0)],
                'clear': [(.2, .08, .37, .165)],  # (his teammate's helmet, above his arm)
                'cut': [[(.2, .08), (.37, .08), (.37, .15), (.3, .168), (.28, .182), (.25, .178), (.22, .168), (.2, .15)],
                        [(0, .15), (.144, .155), (.222, .203), (.26, .222), (.3, .248), (.322, .255), (.322, .303), (.316, .404), (.306, .444),
                         (.289, .465), (.25, .556), (.228, .646), (.217, .707), (.2, .808), (.189, .859), (.18, .97), (0, .97)]]},
    # Aidan Hutchinson (the teammate behind him: below his raised arm and down his left side)
}
# What a picture leaves on the cut-out that is not him, outlined by hand (fractions of the crop, or of the upscaled card):
# 'cut', polygons to clear (a card's frame or lettering that survived the bands, an autograph, another player); 'band',
# a card's own (left, top, right, bottom) in place of CARD_KEEP where its photo sits elsewhere
CLEAR = {
    'xartmonk': {'cut': [[(0.53, 0.475), (0.56, 0.47), (0.64, 0.465), (0.675, 0.5), (0.675, 0.6), (0.7, 0.615), (0.74, 0.625), (0.74, 0.86), (0.34, 0.86), (0.345, 0.787), (0.39, 0.787), (0.43, 0.793), (0.45, 0.793), (0.455, 0.78), (0.475, 0.75), (0.49, 0.72), (0.505, 0.69), (0.525, 0.65), (0.53, 0.6)], [(0.72, 0.77), (0.9, 0.77), (0.9, 0.87), (0.72, 0.87)], [(0.09, 0.06), (0.29, 0.06), (0.29, 0.22), (0.09, 0.22)]], 'band': (0.08, 0.03, 0.86, 0.84)},  # Art Monk
    'xbarrysanders': {'cut': [[(0, 0), (0.99, 0), (0.99, 0.14), (0.66, 0.14), (0.66, 0.08), (0.46, 0.08), (0.46, 0.14), (0, 0.14)], [(0.74, 0), (0.99, 0), (0.99, 0.6), (0.905, 0.6), (0.905, 0.47), (0.88, 0.42), (0.87, 0.34), (0.82, 0.3), (0.8, 0.26), (0.76, 0.21), (0.74, 0.19)], [(0.81, 0.595), (0.99, 0.595), (0.99, 0.87), (0.7, 0.87), (0.7, 0.835), (0.805, 0.835), (0.805, 0.68), (0.81, 0.68)], [(0.765, 0.705), (0.805, 0.705), (0.805, 0.74), (0.765, 0.74)]], 'band': (0.06, 0.07, 0.99, 0.84)},  # Barry Sanders
    'xdanfouts': {'cut': [[(0.905, 0.25), (0.99, 0.25), (0.99, 0.9), (0.905, 0.9), (0.905, 0.61), (0.94, 0.61), (0.94, 0.5), (0.905, 0.5)]], 'band': (0.06, 0.08, 0.95, 0.865)},  # Dan Fouts
    'xericdickerson': {'cut': [[(0.9, 0.77), (1, 0.75), (1, 1), (0.89, 1), (0.89, 0.9)]]},  # Eric Dickerson
    'xfrancoharris': {'cut': [[(0.2, 0.04), (0.96, 0.04), (0.96, 0.3), (0.9, 0.3), (0.895, 0.27), (0.885, 0.245), (0.87, 0.22), (0.855, 0.21), (0.83, 0.2), (0.83, 0.19), (0.815, 0.18), (0.8, 0.17), (0.8, 0.158), (0.575, 0.158), (0.56, 0.19), (0.2, 0.19)], [(0.1, 0.18), (0.4, 0.18), (0.4, 0.3), (0.335, 0.35), (0.32, 0.38), (0.31, 0.42), (0.3, 0.46), (0.29, 0.5), (0.1, 0.5)], [(0.925, 0.3), (0.98, 0.3), (0.98, 0.99), (0.925, 0.99)], [(0.55, 0.92), (0.65, 0.9), (0.75, 0.875), (0.85, 0.855), (0.93, 0.835), (0.98, 0.82), (0.98, 0.99), (0.55, 0.99)]], 'band': (0.09, 0.06, 0.93, 0.94)},  # Franco Harris
    'xjacklambert': {'cut': [[(0, 0.4), (0.07, 0.4), (0.07, 0.72), (0, 0.72)], [(0, 0.76), (0.12, 0.76), (0.17, 0.86), (0.17, 1), (0, 1)]]},  # Jack Lambert
    'xlancealworth': {'cut': [[(0.09, 0.06), (0.93, 0.06), (0.93, 0.32), (0.915, 0.32), (0.905, 0.26), (0.895, 0.23), (0.885, 0.21), (0.865, 0.19), (0.835, 0.17), (0.8, 0.155), (0.77, 0.145), (0.09, 0.145)], [(0.09, 0.145), (0.58, 0.145), (0.58, 0.3), (0.44, 0.32), (0.4, 0.35), (0.37, 0.4), (0.365, 0.5), (0.35, 0.56), (0.335, 0.62), (0.335, 0.96), (0.09, 0.96)], [(0.907, 0.3), (0.96, 0.3), (0.96, 0.96), (0.907, 0.96)], [(0, 0.952), (0.12, 0.948), (0.2, 0.942), (0.3, 0.933), (0.4, 0.924), (0.5, 0.915), (0.6, 0.906), (0.7, 0.896), (0.8, 0.887), (0.88, 0.88), (1, 0.876), (1, 1), (0, 1)]], 'band': (0.09, 0.06, 0.925, 0.955)},  # Lance Alworth
    'xpaulkrause': {'cut': [[(0.91, 0.38), (1, 0.38), (1, 0.82), (0.91, 0.82)], [(0.8, 0.845), (0.92, 0.845), (0.92, 0.93), (0.8, 0.93)]], 'band': (0.05, 0.085, 0.91, 0.82)},  # Paul Krause
    'xwalterjones': {'cut': [[(0.76, 0.12), (0.95, 0.12), (0.95, 0.58), (0.86, 0.63), (0.8, 0.6), (0.755, 0.55), (0.755, 0.4), (0.76, 0.36)]], 'band': (0.22, 0.05, 0.93, 0.84)},  # Walter Jones
}
# An autograph in ink across a photo (Gale Sayers' signed print): the ink's hue range (OpenCV's 0-179 scale) is painted out
# before the cut-out (ink_out: the ink's strokes found by hue and saturation, filled from round them, their colour neutral)
INK = {'xgalesayers': (110, 132)}  # Gale Sayers: a blue signature across his legs
# The year a Commons photo was taken, where its page gives none or its upload date instead
YEAR = {'xraylewis': 2007, 'xjohnnyunitas': 1963}
# Players whose picture was redone since VERSION (a new pick, card or crop): their own version in the file name, so only
# they are rebuilt and fetched again; build leaves every other player's finished picture as it is
REDO = {
    'xraylewis': 'v4', 'xtombrady': 'v4', '0036358': 'v4', '0033288': 'v4', '0034856': 'v4', '0037250': 'v4',
    'xbrettfavre': 'v4', 'xaarondonald': 'v4', '0037236': 'v4',
    'xjohnnyunitas': 'v4', 'xgalesayers': 'v4',
    'xartmonk': 'v4', 'xbarrysanders': 'v4', 'xdanfouts': 'v4', 'xericdickerson': 'v4', 'xfrancoharris': 'v4', 'xjacklambert': 'v4', 'xlancealworth': 'v4', 'xpaulkrause': 'v4', 'xwalterjones': 'v4',  # Legends: card remnants cleared by hand
    '0034857': 'v4', '0033106': 'v4', '0034973': 'v4',  # Josh Allen, Jared Goff, Maxx Crosby: Commons originals over their card scans
    '0036997': 'v4', '0033886': 'v4', '0034790': 'v5',  # Javonte Williams, T.J. Watt, Derwin James: the same
    '0039337': 'v4',  # Malik Nabers: a Commons photo from action_sweep.py's named photos
    '0036442': 'v4',  # Joe Burrow: a Commons photo from action_sweep.py's named photos
    '0036971': 'v4',  # Trevor Lawrence: a Commons photo from action_sweep.py's named photos
    '0040663': 'v4',  # Harold Fannin Jr.: a Commons photo from action_sweep.py's named photos
    '0034351': 'v4',  # Dallas Goedert: a Commons photo from action_sweep.py's named photos
    '0038542': 'v4',  # Bijan Robinson: a Commons photo from action_sweep.py's named photos
    '0030506': 'v4',  # Travis Kelce: a Flickr photo from action_sweep.py's Flickr sheets
    'xjustintucker': 'v4',  # Justin Tucker: a Flickr photo from action_sweep.py's Flickr sheets
    'xpeytonmanning': 'v4',  # Peyton Manning: a Flickr photo from action_sweep.py's Flickr sheets
    'xcalvinjohnson': 'v4',  # Calvin Johnson: a Commons photo from action_sweep.py's named photos
    'xladainiantomli': 'v4',  # LaDainian Tomlinson: a Commons photo from action_sweep.py's named photos
    'xrandymoss': 'v4',  # Randy Moss: a Commons photo from action_sweep.py's named photos
}

# The trading-card photos (the owner, Oct 31 2026: "Where can we find live action pictures of the players that would be
# used for trading cards? There should be a clean cutout of the player in game"): a Rare+ player's cut-out comes from his
# own trading card (img/dynasty/real, from the owner's CardSight downloads): his newest base card, else his first card
# that is a photo. CARD_SKIP: cards that aren't a game photo (checked by eye); CARD: a chosen card instead.
CARD_SKIP = {
    'fc82d7dd', '3093deb0', '9a235ca8', 'ae347531', 'bba16172',  # All-Time Gridiron Kings: painted
    '286a2648',  # Aidan Hutchinson, Gridiron Kings: a painted portrait
    '92700d36', '9dfab4c9', '07bb8346',  # Bomb Squad (Marino, Favre, Caleb Williams): comic-book art round the photo
    'e867d665',  # Morten Andersen, 2024 Mosaic: his Hall of Fame enshrinement
    '6997530b',  # Joe Montana, Downtown: his photo on a drawn city
    'ec2e8d1f',  # Jan Stenerud, Legend Series: a portrait
    '7b65f17e',  # Tim Brown, 2025 Score: two small photos in a frame
    '65617d0d',  # Ken Houston, 2025 Score: a faded black-and-white photo
    '1528d5d5',  # Anthony Muñoz, 2025 Donruss: his photo won't come apart from its frame
    '4e796bee',  # John Mackey, 2007 Donruss: his photo won't come apart from its patterned ground
    'e2dd5e60',  # Jalen Carter, Champ Is Here: lettering over him
    'd406c52a',  # Wyatt Teller, 2023 Score: its frame runs through him
    'ecb05cda',  # Tykee Smith, 2024 Topps Chrome: won't come apart from the refractor
}
CARD = {}
# Players whose Commons photo (PICK) is used ahead of his card's: where the card's cut-out falls short
# Players whose Commons photo (PICK) is used ahead of his card's (the owner, Nov 1 2026: "Ensure good quality pictures are
# being used. The card scans might be too fuzzy"): the 160 x 225 scans stay soft even upscaled, so a sharp (800+ px)
# Commons game photo of him alone in uniform wins, chosen by eye side by side; also where a card's pattern stays on him
COMMONS_FIRST = {
    'xadrianpeterson', 'xchampbailey', 'xdrewbrees', 'xedreed', 'xericdickerson', 'xmarvinharrison',  # Adrian Peterson, Champ Bailey, Drew Brees, Ed Reed, Eric Dickerson, Marvin Harrison
    'xtombrady', 'xtroypolamalu', '0023459', '0040122', '0038542', '0034836',  # Tom Brady, Troy Polamalu, Aaron Rodgers, Ashton Jeanty, Bijan Robinson, Braden Smith
    '0037692', '0033890', '0039918', '0040579', '0032762', '0034768',  # Brandon Aubrey, Budda Baker, Caleb Williams, Carson Schwesinger, Chris Jones, Chukwuma Okorafor
    '0034351', '0036912', '0034856', '0034815', '0033288', '0040663',  # Dallas Goedert, DeVonta Smith, Denzel Ward, Fred Warner, George Kittle, Harold Fannin Jr.
    '0036900', '0031492', '0036442', '0035642', '0036322', '0029592',  # Ja'Marr Chase, Jason Myers, Joe Burrow, Josh Hines-Allen, Justin Jefferson, Kevin Zeitler
    '0034759', '0034796', '0033131', '0037250', '0039067', '0036410',  # Kolton Miller, Lamar Jackson, Maliek Collins, Martin Emerson, Rashee Rice, Tee Higgins
    '0038563', '0036971', '0038996', '0039111',  # Tre Tucker, Trevor Lawrence, Tucker Kraft, Tuli Tuipulotu
    '0036358',  # CeeDee Lamb (his card's photo had a defender against him)
    '0034857', '0033106', '0034973',  # Josh Allen, Jared Goff, Maxx Crosby (sharp originals from action_sweep.py's named photos)
    '0036997', '0033886', '0034790',  # Javonte Williams, T.J. Watt, Derwin James (the same)
    '0039337',  # Malik Nabers (action_sweep.py's named photos)
    '0030506',  # Travis Kelce (action_sweep.py's Flickr sheets)
    'xjustintucker',  # Justin Tucker (action_sweep.py's Flickr sheets)
    'xpeytonmanning',  # Peyton Manning (action_sweep.py's Flickr sheets)
    'xcalvinjohnson',  # Calvin Johnson (action_sweep.py's named photos)
    'xladainiantomli',  # LaDainian Tomlinson (action_sweep.py's named photos)
    'xrandymoss',  # Randy Moss (action_sweep.py's named photos)
}
# (Commons photos that are a portrait, a posed head-and-shoulders or a stamp, not a game, are left out of PICK: the owner,
# Oct 31 2026, "Remove any headshot of the legend players")
# The card's own lettering (team names across the top, name plates and logos along the foot) stays off the cut-out:
# a card scan's cut-out keeps only what lies inside these bands (fractions of its width and height)
CARD_KEEP = (.04, .05, .96, .84)
BAND = {'Canton Kings': (.04, .05, .96, .76)}  # (a set whose lettering sits higher: its own bands)
SEASON = 2026   # this season (a Live player's first season: SEASON - his years in the league)

# player key -> the Commons file chosen by eye (its name as the file page has it, without "File:"), or 'flickr:<photo id>'
# for a photo from action_sweep.py's Flickr sheets
PICK = {
    "xjerryrice": "Jerry_Rice_1985.jpg",  # Jerry Rice, 1985
    "xlawrencetaylor": "Lawrence_Taylor_tackle.jpg",  # Lawrence Taylor, 1984
    "xtombrady": "Tom_Brady_(2).jpg",  # Tom Brady, a Patriots pass (the Buccaneers crop stopped at his chest)
    "xjimbrown": "Jim_Brown_1959_Topps_cropped_and_recoloured.jpg",  # Jim Brown, 1959
    "xpeytonmanning": "flickr:5043838891",  # Peyton Manning, 2010, warming up, helmet in hand
    "xreggiewhite": "19981213_28_Reggie_White,_Lambeau_Field_(cropped).jpg",  # Reggie White, 1998
    "xaarondonald": "Aaron_Donald_2020.jpg",  # Aaron Donald, 2020, the whole photo (the crop stopped at his chest)
    "xjoemontana": "1986_Jeno's_Pizza_-_28_-_Roger_Craig_(Joe_Montana_crop).jpg",  # Joe Montana, 1985
    "xjohnnyunitas": "Unitas-Johnny-1963.jpg",  # Johnny Unitas, 1963, set to pass (the 1958 Topps card was painted)
    "xrandymoss": "Randy_Moss_with_Vikings.jpg",  # Randy Moss, with the Vikings, 2010
    "xraylewis": "Ray_Lewis_2007.jpg",  # Ray Lewis, 2007 (alone, the whole of him; the 2008 game photo had a Steeler in it)
    "xwalterpayton": "1986_Jeno's_Pizza_-_12_-_Walter_Payton_(Walter_Payton_crop).jpg",  # Walter Payton, 1984
    "xcalvinjohnson": "Calvin_Johnson_vs_Green_Bay.jpg",  # Calvin Johnson, at Green Bay
    "xedreed": "Ed_reed_ravens2012.jpg",  # Ed Reed, 2012
    "xgalesayers": "Gale_sayers_playing.jpg",  # Gale Sayers, 1972
    "xladainiantomli": "Tomlinson_warming_up_1.jpg",  # LaDainian Tomlinson, warming up with the ball
    "xrobgronkowski": "Rob_Gronkowski_2021_(cropped).jpg",  # Rob Gronkowski, 2021
    "xronnielott": "Ronnie_lott_big_portrait.jpg",  # Ronnie Lott, 2013
    "xadamvinatieri": "Rigoberto_Sanchez,_Adam_Vinatieri_(44679700592)_(cropped).jpg",  # Adam Vinatieri, 2018
    "xboblilly": "Bob_lilly_signed.jpg",  # Bob Lilly, 1961
    "xbrettfavre": "David_Martin82_Brett_Favre4-Edit2.jpg",  # Brett Favre, a Packers pass (the 1998 photo was on the sideline in a cap)
    "xdarrellerevis": "Darrelle_Revis_2014.jpg",  # Darrelle Revis, 2007
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
    "xbartstarr": "Bart_Starr_1958.jpg",  # Bart Starr, 1958
    "xbrucematthews": "Bruce_Matthews_cropped.jpg",  # Bruce Matthews, 1984
    "xchampbailey": "Champ_Bailey_2010.JPG",  # Champ Bailey, 2010
    "xcharleswoodson": "Charles_Woodson_2014_2_(cropped).JPG",  # Charles Woodson, 2014
    "xdarrellgreen": "Darrell_Green_8-4-02_020804-N-5086M-004.jpg",  # Darrell Green, 2002
    "xfrantarkenton": "Tarkenton_calling_vikings.jpg",  # Fran Tarkenton, 1978
    "xginomarchetti": "Gino_Marchetti_1961.jpg",  # Gino Marchetti, 1961
    "xjackham": "JackHamPIT.png",  # Jack Ham, 1982
    "xjoenamath": "1986_Jeno's_Pizza_-_37_-_Joe_Namath_(Joe_Namath_crop).jpg",  # Joe Namath, 1969
    "xjuniorseau": "Junior_Seau_with_Patriots_side_view_cropped.jpg",  # Junior Seau, 2008
    "xmarvinharrison": "Marvin_Harrison_in_2007_Training_Camp_2.jpg",  # Marvin Harrison, 2008
    "xraynitschke": "Nitschke_packers.jpg",  # Ray Nitschke, 1966
    "xterrellowens": "Terrell-Owens-Aug302007-Vikings-Preseason.jpg",  # Terrell Owens, 2007
    "xwalterjones": "Walter-Jones-2008-11-02-vsEagles.jpg",  # Walter Jones, 2008
    "xbriandawkins": "Brian_Dawkins.JPG",  # Brian Dawkins, 2009
    "xcriscarter": "CC_Pro_Bowl.JPG",  # Cris Carter, 1999
    "xdanfouts": "1986_Jeno's_Pizza_-_53_-_Dan_Fouts_and_Don_Macek_(Dan_Fouts_crop).jpg",  # Dan Fouts, 1982
    "xfrancoharris": "1986_Jeno's_Pizza_-_46_-_Terry_Bradshaw_(Franco_Harris_crop).jpg",  # Franco Harris, 1980
    "xjustintucker": "flickr:50425638927",  # Justin Tucker, 2020, kicking at Washington
    "xkellenwinslow": "Kellen_Winslow_circa_1986.jpg",  # Kellen Winslow, 1987
    "xkurtwarner": "Kurt_Warner_(2009_Pro_Bowl).jpg",  # Kurt Warner, 2009
    "xmarcusallen": "1985_Police_Raiders-Rams_-_01_Marcus_Allen_(crop).jpg",  # Marcus Allen, 1984
    "xpaulwarfield": "Paul_Warfield_1971MIA.png",  # Paul Warfield, 1971
    "xterrybradshaw": "1983_Steelers_Police_-_04_Terry_Bradshaw_(crop).jpg",  # Terry Bradshaw, 1982
    "xwillielanier": "WillieLanierKC.png",  # Willie Lanier, 1986
    "xjackyoungblood": "JackYoungbloodLA.png",  # Jack Youngblood, 1980
    "xlembarney": "LemBarneyDET.png",  # Lem Barney, 1968
    "xlendawson": "Kansas_City_Chiefs_at_Denver_Broncos_1985-12-14_(ticket)_(crop).jpg",  # Len Dawson, 1970
    "xlennymoore": "1956_topps_lenny_moore.jpg",  # Lenny Moore, 1956
    "xpaulkrause": "1986_Jeno's_Pizza_-_18_-_Alan_Page_(Paul_Krause_crop).jpg",  # Paul Krause, 1977
    "xsamhuff": "Sam_huff_redskins.jpg",  # Sam Huff, 1964
    "xwarrenmoon": "Warren_Moon_and_Mike_Rozier_1987.jpg",  # Warren Moon, 1987
    "xjohnriggins": "JohnRiggins1983TrainingCamp.jpg",  # John Riggins, 2008
    "0027857": "Trent_Willams_2020_(cropped).jpg",  # Trent Williams, 2020
    "0032726": "Ka'imi_Fairbairn_(45034655335)_(cropped).jpg",  # Ka'imi Fairbairn, 2018
    "0034857": "Josh_Allen_(30419600128).jpg",  # Josh Allen, 2018, a pass at Cleveland
    "0037236": "Commanders_at_Lions_(52379162544).jpg",  # Aidan Hutchinson, 2022, celebrating a play (the old photo was on the bench, no helmet)
    "0037841": "2025_Rams_vs_Titans_Quentin_Lake.png",  # Quentin Lake, 2025
    "0029592": "Kevin_Zeitler.JPG",  # Kevin Zeitler, 2015
    "0034973": "Maxx_Crosby_WFT-Raiders_DEC2021.jpg",  # Maxx Crosby, 2021, kneeling on the field
    "0030097": "David_Quessenberry_2021_09-19.jpg",  # David Quessenberry, 2021
    "0033886": "TJ_Watt.jpg",  # T.J. Watt, 2019, at Cleveland
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
    "0036358": "Washington_at_Dallas_Photo_110_(51787382465).jpg",  # CeeDee Lamb, 2021, alone with the ball (his card had a defender on him)
    "0036564": "Hufanga_2025.png",  # Talanoa Hufanga, 2025
    "0031330": "NFL_2020_-_Playoffs_-_Washington_vs._Buccaneers_209_(50833182757).jpg",  # Morgan Moses, 2021
    "0032071": "Trenton_Brown.JPG",  # Trent Brown, 2015
    "0034351": "Dallas_Goedert.jpg",  # Dallas Goedert, 2019, running in at Washington
    "0034974": "Julian_Love_(cropped).jpg",  # Julian Love, 2019
    "0036223": "Jonathan_Taylor_Colts_OCT2022_(cropped).jpg",  # Jonathan Taylor, 2022
    "0036900": "Commanders_vs._Bengals_-_54752531474.jpg",  # Ja'Marr Chase, 2025
    "0037238": "Drake_London_Falcons_camp_2022.png",  # Drake London, 2022
    "0037244": "Devin_Lloyd_and_Logan_Thomas_2022_2.jpg",  # Devin Lloyd, 2022
    "0039851": "Drake_Maye_Patriots_vs_Titans_NOV2024.png_(section)_(cropped).png",  # Drake Maye, 2024
    "0032234": "Laken_Tomlinson_with_49ers.jpg",  # Laken Tomlinson, 2017
    "0032391": "Joe_Thuney.JPG",  # Joe Thuney, 2017
    "0032445": "Ted_Karras_(offensive_lineman).JPG",  # Ted Karras, 2016
    "0033288": "49ers_at_Redskins_2019,_George_Kittle_(48933294286).jpg",  # George Kittle, 2019, running (the crop was his head and chest, no helmet)
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
    "0039337": "Commanders_vs._Giants_2025_20.jpg",  # Malik Nabers, 2025, airborne at Washington
    # (Oct 31 2026: the Rare and better cards' players without one yet; a college game where no NFL photo was free)
    "0038542": "Bijan_Robinson_2025.jpg",  # Bijan Robinson, 2025, off the snap (ALONE: Segment Anything carved his chest)
    "0036994": "Ernest_Jones_South_Carolina.jpg",  # Ernest Jones, 2019
    "0037192": "George_Karlaftis.jpg",  # George Karlaftis, 2022
    "0037239": "IX8A4137_(45339431234)_(cropped).jpg",  # Chris Olave, 2018
    "0038386": "Jalen_Carter.png",  # Jalen Carter, 2023
    "0038560": "Jordan_Battle,_2021.jpg",  # Jordan Battle, 2021
    "0037840": "NFL_Playoff_Wildcard_Game_-_Kyren_Williams_Running_Back_Rams_(54266524948).jpg",  # Kyren Williams, 2025
    "0039065": "SamLaPorta.jpg",  # Sam LaPorta, 2021
    "0031492": "Jason_Myers_-_51720303739_(cropped).jpg",  # Jason Myers, 2021
    "0033106": "Jared_Goff_2022.jpg",  # Jared Goff, 2022, alone on the field
    "0033831": "Andrew_Wylie-1st_&_Goal-Chiefs_at_Buccaneers_(52402413344)_(cropped).jpg",  # Andrew Wylie, 2022
    "0035272": "Andrew_Van_Ginkel_Dolphins-Falcons_OCT2021.png",  # Andrew Van Ginkel, 2021
    "0036388": "Xavier_McKinney_WFT-NYG_JAN2022_(cropped).jpg",  # Xavier McKinney, 2022
    "0036554": "Nico_Collins_2019.jpg",  # Nico Collins, 2019
    "0036986": "Nahshon_Wright.jpg",  # Nahshon Wright, 2025
    "0036997": "Javonte_WIlliams_2025.jpg",  # Javonte Williams, 2025, a carry for Dallas
    "0038038": "Kyle_Hamilton_Ravens_Training_Camp_AUG2023_(cropped).jpg",  # Kyle Hamilton, 2023
    "0039018": "Jack_Campbell_Iowa_(cropped).jpg",  # Jack Campbell, 2022
    "0040128": "Tyler_Warren_pro_bowl.png",  # Tyler Warren, 2026
    "0032764": "Derrick_Henry_Titans_vs_Commanders_OCT2022.jpg",  # Derrick Henry, 2022
    "0034158": "Brian_O'Neill_2020.png",  # Brian O'Neill, 2020
    "0035358": "Chase_McLaughlin_(51402814375)_(cropped).jpg",  # Chase McLaughlin, 2021
    "0036418": "ZackBaunUW2018_(cropped).jpg",  # Zack Baun, 2018
    "0036442": "Joe_Burrow_Bengals.jpg",  # Joe Burrow, 2020, alone in the pocket
    "0036912": "Devonta_Smith_2022_(cropped).jpg",  # DeVonta Smith, 2022
    "0037240": "Jameson_Williams.png",  # Jameson Williams, 2021
    "0038996": "2025_Commanders_at_Packers_77.jpg",  # Tucker Kraft, 2025
    "0039852": "Jared_Verse_(cropped).jpg",  # Jared Verse, 2026
    "0039888": "Quinyon_Mitchell_Toledo_Rockets_Football,_December_2023.jpg",  # Quinyon Mitchell, 2023
    "0040122": "2025_Raiders_at_Commanders_106.jpg",  # Ashton Jeanty, 2025
    "0033131": "Maliek_Collins.jpg",  # Maliek Collins, 2017
    "0036220": "Derrick_Brown_(American_football).jpg",  # Derrick Brown, 2020
    "0037692": "Brandon_Aubrey_10_1_2023.jpg",  # Brandon Aubrey, 2023
    "0039838": "Calen_Bullock_pro_bowl.png",  # Calen Bullock, 2026
    "0039860": "Kool-Aid_McKinstry_2021.jpg",  # Kool-Aid McKinstry, 2021
    "0031364": "Jadeveon_Clowney_vs_Redskins_2018.jpg",  # Jadeveon Clowney, 2018
    "0031898": "Alex_Singleton_1_(cropped).jpg",  # Alex Singleton, 2022
    "0034429": "Jordan_Mailata.jpg",  # Jordan Mailata, 2020
    "0034495": "Evan_Brown_(52379162989)_(cropped).jpg",  # Evan Brown, 2022
    "0034668": "Aaron_Stinnie_2018_08-09.jpg",  # Aaron Stinnie, 2018
    "0034675": "Jessie_Bates_III_(31015688557)_(cropped).jpg",  # Jessie Bates, 2018
    "0034759": "Kolton_Miller_2025.jpg",  # Kolton Miller, 2025
    "0034856": "Denzel_Ward_(43775487861).jpg",  # Denzel Ward, 2018 camp, helmet on and the ball in hand
    "0035230": "Ed_Oliver_2021_(cropped).jpg",  # Ed Oliver, 2021
    "0035261": "Tony_Pollard_(cropped).jpg",  # Tony Pollard, 2019
    "0035687": "Bobby_Okereke_(7370935)_(cropped).jpg",  # Bobby Okereke, 2022
    "0036971": "Trevor_Lawrence_Commanders_vs_Jaguars_SEP2022.jpg",  # Trevor Lawrence, 2022, rolling out at Washington
    "0036974": "Tyson_Campbell_(cropped).jpg",  # Tyson Campbell, 2026
    "0037228": "Jaylen_Warren_Cropped.jpg",  # Jaylen Warren, 2024
    "0037250": "2022_Cleveland_Browns_Training_Camp_(52339586867).jpg",  # Martin Emerson, 2022 camp, running alone
    "0038563": "Tre_Tucker_(54841331175)_(cropped).jpg",  # Tre Tucker, 2025
    "0039067": "Rashee_Rice_(55090108907)_(cropped).jpg",  # Rashee Rice, 2026
    "0039491": "Jalen_Coker.jpg",  # Jalen Coker, 2026
    "0040579": "Carson_Schwesinger_2025_Browns_Camp_(cropped).jpg",  # Carson Schwesinger, 2025
    "0041528": "Michael_Taaffe.jpg",  # Michael Taaffe, 2024
    "0032762": "Chris_Jones_(defensive_tackle,_born_1994).JPG",  # Chris Jones, 2017
    "0033890": "Budda_Baker.JPG",  # Budda Baker, 2017
    "0034768": "Chukwuma_Okorafor_(50695534763)_(cropped).jpg",  # Chukwuma Okorafor, 2020
    "0034836": "Braden_Smith_at_Lambeau_Field.jpg",  # Braden Smith, 2024
    "0035676": "Aj_brown_titans_vs_browns.png",  # A.J. Brown, 2020
    "0036322": "Jefferson_2022.jpg",  # Justin Jefferson, 2022
    "0039172": "Jake_Bates_(53752265654)_(cropped).jpg",  # Jake Bates, 2024
    "0039918": "Commanders_vs._Bears_(54857809842).jpg",  # Caleb Williams, 2025
    "0040663": "Harold_Fannin_Jr._3.jpg",  # Harold Fannin Jr., 2026, at Browns camp
    "0034796": "Lamar_Jackson_passing_2020_(cropped).jpg",  # Lamar Jackson, 2020
    "0039163": "CJ_Stroud_in_2026.jpg",  # C.J. Stroud, 2026
    "0023459": "AaronRodgersSteelers_(cropped).jpg",  # Aaron Rodgers, 2025
    "0033873": "Patrick_Mahomes_on_the_run_(51616124184).jpg",  # Patrick Mahomes, 2021
    "xjoethomas": "Joe_Thomas_Cleveland_Browns.jpg",  # Joe Thomas, 2011, at camp in his #73
    "0034790": "Derwin_James_-_2025_Commanders_at_Chargers.jpg",  # Derwin James, 2025, running out
    "0030506": "flickr:51614629582",  # Travis Kelce, 2021, running with the ball at Washington
}
# player key -> (centre x, top, height) as fractions of the photo's width and height
CROP = {
    "xjohnnyunitas": (0.5, 0.02, 0.96),  # Johnny Unitas
    "xaarondonald": (0.47, 0, 1),  # Aaron Donald (Floyd, at the right, left to Segment Anything)
    "0037236": (0.55, 0.05, 0.95),  # Aidan Hutchinson
    "xtombrady": (0.55, 0, 1),  # Tom Brady
    "0036358": (0.75, 0, 1),  # CeeDee Lamb (the teammate at the left left out)
    "0033288": (0.5, 0.1, 0.9),  # George Kittle
    "0034856": (0.5, 0.05, 0.95),  # Denzel Ward
    "0037250": (0.47, 0, 0.95),  # Martin Emerson
    "xlawrencetaylor": (0.55, 0.2, 0.6),  # Lawrence Taylor
    "xpeytonmanning": (0.53, 0.02, 0.72),  # Peyton Manning
    "xreggiewhite": (0.5, 0, 1),  # Reggie White
    "xgalesayers": (0.5, 0.08, 0.7),  # Gale Sayers
    "xbrettfavre": (0.55, 0.12, 0.88),  # Brett Favre
    "xdarrellerevis": (0.5, 0, 1),  # Darrelle Revis
    "xdarrellgreen": (0.5, 0, 0.7),  # Darrell Green
    "xwarrenmoon": (0.25, 0, 1),  # Warren Moon
    "0034857": (0.5, 0.02, 0.98),  # Josh Allen
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
    "0039337": (0.37, 0.1, 0.9),  # Malik Nabers
    "0037834": (0.55, 0, 0.55),  # Brock Purdy
    "0038542": (0.5, 0, 1),  # Bijan Robinson
    "0037840": (0.36, 0.36, 0.4),  # Kyren Williams
    "0033106": (0.5, 0, 1),  # Jared Goff
    "0036442": (0.5, 0.02, 0.98),  # Joe Burrow
    "0037228": (0.47, 0.12, 0.82),  # Jaylen Warren
    "0039918": (0.25, 0.08, 0.92),  # Caleb Williams
    "0039163": (0.45, 0.2, 0.55),  # C.J. Stroud
    "0023459": (0.6, 0.03, 0.6),  # Aaron Rodgers
    "0033873": (0.37, 0.18, 0.8),  # Patrick Mahomes
    "0034973": (0.47, 0.25, 0.72),  # Maxx Crosby (the kicker at the right left out)
    "xjoethomas": (0.48, 0.03, 0.97),  # Joe Thomas
    "0036997": (0.55, 0.06, 0.95),  # Javonte Williams
    "0033886": (0.5, 0.02, 0.58),  # T.J. Watt
    "0034790": (0.38, 0.08, 0.92),  # Derwin James
    "0036971": (0.5, 0.05, 0.92),  # Trevor Lawrence
    "0040663": (0.5, 0.12, 0.85),  # Harold Fannin Jr.
    "0034351": (0.11, 0.05, 0.75),  # Dallas Goedert
    "0030506": (0.56, 0.08, 0.88),  # Travis Kelce
    "xjustintucker": (0.42, 0.12, 0.87),  # Justin Tucker
    "xcalvinjohnson": (0.5, 0.04, 0.96),  # Calvin Johnson
    "xladainiantomli": (0.48, 0.1, 0.9),  # LaDainian Tomlinson
    "xrandymoss": (0.5, 0, 1),  # Randy Moss
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
            # (a server error that persists, as some file pages give: no page, not cached, so a later run asks again)
            if e.code >= 500 and n >= 2:
                return ''
            if e.code != 429 and e.code < 500 or n == 9:
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


def rare_players():
    """The players whose cards are Rare or better: those with a real trading card (core/dynasty-real.js REAL)."""
    src = open(REAL_JS, encoding='utf-8').read()
    return set(re.findall(r"^\s*'([^']+)':\s*\[\[", src, re.M))


def real_cards():
    """Each player's real trading cards (core/dynasty-real.js REAL): key -> [[card id's first 8, year, release, set, number]]."""
    src = open(REAL_JS, encoding='utf-8').read()
    return {k: json.loads(v.replace("'", '"')) for k, v in re.findall(r"^  '([^']+)': (\[\[.*?\]\]),", src, re.M)}


def card_for(key, real):
    """The trading card whose photo his action cut-out comes from: CARD's, else his newest base card, else his first card
    that is a photo (CARD_SKIP: painted and portrait inserts); None for none."""
    cards = real.get(key, [])
    if key in CARD:
        return next((e for e in cards if e[0] == CARD[key]), None)
    ok = [e for e in cards if e[0] not in CARD_SKIP]
    # (Donruss base cards first: a clean photo on a light frame; Topps Chrome's dark refractors cut out worse)
    return next((e for e in ok if e[3] == 'Base Set' and 'Donruss' in e[2]), next((e for e in ok if e[3] == 'Base Set'), ok[0] if ok else None))


def club():
    """The players on Rare or better cards, and every Legend (no Legend wears a headshot): [(key, name, team name, pos,
    college, (first season, last season))]."""
    d = json.load(open(DATA, encoding='utf-8'))
    rare = rare_players()
    best, span = {}, {}
    for c in d['cards']:
        if c[2] in rare or c[1] == 'X':
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
    # (the original's size, not the preview's)
    size = re.search(r'class="fileInfo">\(([\d,]+) × ([\d,]+) pixels', h) or re.search(r'([\d,]+) × ([\d,]+) pixels', h)
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
    only = set(sys.argv[3:] if part else sys.argv[2:])
    if only == {'missing'}:
        only = {k for k, *_ in players} - set(PICK)
    name_of = 'candidates-%s-%s.json' % part.groups() if part else 'candidates-some.json' if only else 'candidates.json'
    for n, (key, name, team, pos, college, span) in enumerate(players):
        if only and key not in only:
            continue
        # (the n-th of the players asked for, so the parts share them evenly)
        if part and sum(1 for k, *_ in players[:n] if not only or k in only) % int(part.group(2)) != int(part.group(1)) - 1:
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
    """A crop of the player in action (hand's, else round the largest face with his shoulders and chest below it, else
    the photo's upper middle), in the window's shape at twice its size (S), saved as a PNG for the cut-out."""
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
    img.crop((round(left), round(top), round(left + cw), round(top + ch))).resize((W * S, H * S), Image.LANCZOS).save(out, 'PNG')
    return bool(f)


def main_figure(a):
    """The largest figure near the middle of a mask (a: alpha array): its labels, its label and the labels' areas and
    centres; (None, ...) for an empty mask."""
    import numpy as np
    from scipy import ndimage
    lab, n = ndimage.label(a > 110)
    if not n:
        return None, None, None, None
    idx = range(1, n + 1)
    area = ndimage.sum(np.ones_like(a), lab, idx)
    centre = ndimage.center_of_mass(np.ones_like(a), lab, idx)
    w = a.shape[1]
    main = max(range(n), key=lambda i: area[i] * (1.15 - abs(centre[i][1] / w - .5)))
    return lab, main + 1, area, centre


def masks(todo, hints=None):
    """Each picture's masks: BiRefNet's portrait model (rembg) for the edge, then Segment Anything prompted with the main
    figure's box and chest, so only he is kept where others touch him. On the CPU, without the memory arena, so one
    process can do them all. todo: [(picture, mask, SAM mask)]."""
    import numpy as np
    import onnxruntime as ort
    from PIL import Image
    from rembg import new_session
    opts = ort.SessionOptions()
    opts.enable_cpu_mem_arena = False
    opts.enable_mem_pattern = False
    need = [(c, m) for c, m, _ in todo if not os.path.exists(m)]
    if need:
        sess = new_session(MODEL, sess_opts=opts)
        for n, (c, m) in enumerate(need):
            sess.predict(Image.open(c).convert('RGB'))[0].convert('L').save(m)
            print(f'  cut out {n + 1}/{len(need)}', os.path.basename(c), file=sys.stderr)
        del sess
    need = [(c, m, q) for c, m, q in todo if not os.path.exists(q)]
    if need:
        sam = new_session(SAM, sess_opts=opts)
        for n, (c, m, q) in enumerate(need):
            img = Image.open(c).convert('RGB')
            hint = (hints or {}).get(q)
            if hint:
                w, h = img.size
                b = hint['box']
                prompt = [{'type': 'rectangle', 'label': 1, 'data': [int(b[0] * w), int(b[1] * h), int(b[2] * w), int(b[3] * h)]}]
                prompt += [{'type': 'point', 'label': l, 'data': [int(x * w), int(y * h)]} for x, y, l in hint['points']]
                got = np.array(sam.predict(img, sam_prompt=prompt)[0].convert('L'))
                for x0, y0, x1, y1 in hint.get('clear', []):
                    got[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = 0
                if hint.get('cut'):
                    from PIL import ImageDraw
                    cut = Image.new('L', img.size, 0)
                    for poly in hint['cut']:
                        ImageDraw.Draw(cut).polygon([(x * w, y * h) for x, y in poly], fill=255)
                    got[np.asarray(cut) > 0] = 0
                Image.fromarray(got).save(q)
                print(f'  isolated by hand {n + 1}/{len(need)}', os.path.basename(c), file=sys.stderr)
                continue
            a = np.asarray(Image.open(m).convert('L').resize(img.size)).astype(np.float32)
            lab, main, _, _ = main_figure(a)
            if lab is None:
                Image.new('L', img.size, 255).save(q)
                continue
            fig = lab == main
            ys, xs = np.nonzero(fig)
            y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
            if fig.sum() > .5 * fig.size:
                # (it took the whole card, his frame and all: ask for the figure inside the card's photo instead)
                h, w = fig.shape
                x0, y0, x1, y1 = int(w * CARD_KEEP[0]), int(h * CARD_KEEP[1]), int(w * CARD_KEEP[2]), int(h * CARD_KEEP[3])
                fig = np.zeros_like(fig)
                fig[y0:y1, x0:x1] = True
            r = int(y0 + .3 * (y1 - y0))
            band = np.nonzero(fig[max(0, r - 3):r + 4])[1]
            chest = [int(np.median(band)) if len(band) else int((x0 + x1) / 2), r]
            prompt = [{'type': 'rectangle', 'label': 1, 'data': [int(x0), int(y0), int(x1), int(y1)]},
                      {'type': 'point', 'label': 1, 'data': chest}]
            sam.predict(img, sam_prompt=prompt)[0].convert('L').save(q)
            print(f'  isolated {n + 1}/{len(need)}', os.path.basename(c), file=sys.stderr)


def ink_out(img, hues):
    """The ink of an autograph painted out of a (black-and-white) photo: strokes of that hue and strong saturation, their
    darkest parts within reach of them, filled in from round them (frequency-selective reconstruction, else Telea), the
    colour under and about them made neutral."""
    import numpy as np
    import cv2
    from PIL import Image
    from scipy import ndimage
    im = np.asarray(img.convert('RGB'))
    hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV)
    hue, sat, val = (hsv[..., i].astype(int) for i in range(3))
    dom = im[..., 2].astype(int) - np.maximum(im[..., 0], im[..., 1]).astype(int)
    sure = (hue >= hues[0]) & (hue <= hues[1]) & (sat > 85) & (dom > 15)
    if not sure.any():
        return img
    hull = cv2.dilate(sure.astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
    dark = hull & (val < 95) & (sat > 30) & (hue >= hues[0] - 10) & (hue <= hues[1] + 10)
    lab, n = ndimage.label(sure | dark)
    size = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i in range(n) if size[i] >= 200]).astype(np.uint8) * 255
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    ink = cv2.dilate(keep, np.ones((9, 9), np.uint8))
    lab3 = cv2.cvtColor(im, cv2.COLOR_RGB2LAB)
    ys, xs = np.nonzero(ink)
    y0, y1, x0, x1 = max(0, ys.min() - 60), min(im.shape[0], ys.max() + 60), max(0, xs.min() - 60), min(im.shape[1], xs.max() + 60)
    L = lab3[y0:y1, x0:x1, 0].copy()
    try:
        dst = np.zeros_like(L)
        cv2.xphoto.inpaint(L, (ink[y0:y1, x0:x1] == 0).astype(np.uint8), dst, cv2.xphoto.INPAINT_FSR_FAST)
    except Exception:
        dst = cv2.inpaint(L, ink[y0:y1, x0:x1], 7, cv2.INPAINT_TELEA)
    lab3[y0:y1, x0:x1, 0] = dst
    wide = cv2.dilate(ink, np.ones((21, 21), np.uint8)) > 0
    lab3[..., 1][wide] = 128
    lab3[..., 2][wide] = 128
    return Image.fromarray(cv2.cvtColor(lab3, cv2.COLOR_LAB2RGB))


def cutout(src, mask, out, sam=None, card=None, hand=False, clear=None, ink=None):
    """The player cut out of his crop: the largest figure near the middle (with what's small and on him, a ball or a
    hand), the rest made clear; trimmed to him and set in the W x H window, standing on its foot and centred (or kept
    against the side the photo cut him at), a little headroom above unless the photo cut his head; a WebP with alpha."""
    import numpy as np
    from PIL import Image
    from scipy import ndimage
    from PIL import ImageFilter
    img = Image.open(src).convert('RGB')
    if ink:
        img = ink_out(img, ink)
    if card:
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    a = np.asarray(Image.open(mask).convert('L').resize(img.size, Image.LANCZOS)).astype(np.float32)
    if card:
        # (card: the bands of the card's photo to keep, a scan's lettering outside them)
        h, w = a.shape
        band = np.zeros_like(a)
        band[int(h * card[1]):int(h * card[3]), int(w * card[0]):int(w * card[2])] = 1
        a = a * band
        lab, main, _, _ = main_figure(a)
        if lab is not None and (lab == main).sum() > .45 * a.size and sam and os.path.exists(sam):
            # (BiRefNet took the whole card: Segment Anything's figure, its edge softened, and nothing outside it)
            from PIL import ImageFilter as F
            a = np.asarray(Image.open(sam).convert('L').resize(img.size).filter(F.GaussianBlur(1.5))).astype(np.float32) * band
            sam = None
    if sam and os.path.exists(sam):
        # (only what Segment Anything found him to be, a little wider so his edge stays BiRefNet's; unless it found only
        # a part of him, his head or his jersey: then the largest figure alone)
        keep = ndimage.binary_dilation(np.asarray(Image.open(sam).convert('L').resize(img.size)) > 127,
                                       iterations=max(3, round(min(img.size) * .012)))
        # (its small holes filled: Segment Anything can speckle a dark mesh jersey, and it only says which figure is his;
        # inside him the edge stays BiRefNet's, which is clear wherever the field shows between his arm and body. A large
        # hole stays: another player inside the ring of a raised arm)
        holes, nh = ndimage.label(ndimage.binary_fill_holes(keep) & ~keep)
        if nh:
            size = ndimage.sum(np.ones_like(holes), holes, range(1, nh + 1))
            keep = keep | np.isin(holes, [i + 1 for i in range(nh) if size[i] < .015 * keep.sum()])
        lab, main, _, _ = main_figure(a)
        # (a hand-prompted mask is trusted even where it keeps much less of the figure: the rest is the other player)
        if lab is not None and (hand or (keep & (lab == main)).sum() >= .75 * (lab == main).sum()):
            a = np.where(keep, a, 0)
    if clear:
        # (CLEAR: what the picture leaves on him that is not him, outlined by hand: a card's frame or lettering that
        # survived the bands, an autograph, another player)
        from PIL import ImageDraw
        m = Image.new('L', img.size, 0)
        for poly in clear:
            ImageDraw.Draw(m).polygon([(x * img.width, y * img.height) for x, y in poly], fill=255)
        a = np.where(np.asarray(m) > 0, 0, a)
    a = np.where(a < 32, 0, a)
    lab, n = ndimage.label(a > 110)
    if n:
        ih, iw = a.shape
        idx = range(1, n + 1)
        area = ndimage.sum(np.ones_like(a), lab, idx)
        cy, cx = zip(*ndimage.center_of_mass(np.ones_like(a), lab, idx))
        main = max(range(n), key=lambda i: area[i] * (1.15 - abs(cx[i] / iw - .5)))
        ys, xs = np.nonzero(lab == main + 1)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        mx, my = (x1 - x0) * .12, (y1 - y0) * .12
        # (and what is small and on him or right by him, a ball or a hand; not lettering or a logo further off)
        near_main = ndimage.binary_dilation(lab == main + 1, iterations=max(2, round(min(a.shape) * .015)))
        keep = [i + 1 for i in range(n) if i == main or area[i] < area[main] * .08
                and x0 - mx <= cx[i] <= x1 + mx and y0 - my <= cy[i] <= y1 + my and (near_main & (lab == i + 1)).any()]
        # (the soft edge round what's kept, not the faint halo of what isn't)
        near = ndimage.binary_dilation(np.isin(lab, keep), iterations=6)
        a = np.where(near, a, 0)
    rgba = np.dstack([np.asarray(img), a.clip(0, 255).astype(np.uint8)])
    cut = Image.fromarray(rgba, 'RGBA')
    box = cut.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, *cut.size)
    iw, ih = cut.size
    edge = 3 * S
    left, right, top = box[0] <= edge, box[2] >= iw - edge, box[1] <= edge
    cut = cut.crop(box)
    room = H if top else round(H * .95)
    k = min(W / cut.width, room / cut.height)
    cut = cut.resize((max(1, round(cut.width * k)), max(1, round(cut.height * k))), Image.LANCZOS)
    x = 0 if left and not right else W - cut.width if right and not left else (W - cut.width) // 2
    frame = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    frame.alpha_composite(cut, (x, H - cut.height))
    frame.save(out, 'WEBP', quality=84, method=6)


def upscale(src, out):
    """A card scan (160 x 225) at four times its size (OpenCV's EDSR), for the cut-out."""
    import cv2
    model = os.path.join(CACHE, 'EDSR_x4.pb')
    if not os.path.exists(model) and not fetch(EDSR, model):
        raise SystemExit('could not fetch the EDSR model')
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(model)
    sr.setModel('edsr', 4)
    cv2.imwrite(out, sr.upsample(cv2.imread(src)))


def prepare():
    """Each Rare+ player's (and each Legend's) photo, ready to cut out: his trading card's photo upscaled, else his Commons
    photo fetched at full size and cropped round him. (rows for ACTION, [(key, source picture, mask, SAM mask, card?)])."""
    players = {k: (name, span) for k, name, _, _, _, span in club()[0]}
    real, rare = real_cards(), rare_players()
    rows, todo = [], []
    for key in players:
        stem = f'{slug(key)}-{REDO.get(key, VERSION)}'
        done = os.path.exists(os.path.join(IMG, stem + '.webp'))
        e = card_for(key, real) if key not in COMMONS_FIRST else None
        if e:
            src = os.path.join(CACHE, f'card-{slug(key)}-{e[0]}-x4.png')
            if not os.path.exists(src) and not done:
                upscale(os.path.join(REAL_IMG, f'{key}-{e[0]}.jpg'), src)
            tag = f'card-{e[0]}'
            row = [stem, 'card:' + e[0], '', '', '', e[1]]
        elif key in PICK and PICK[key].startswith('flickr:'):
            # (a Flickr photo, chosen from action_sweep.py's sheets: its owner, licence, year and page from Flickr's API)
            from action_sweep import flickr_info
            pid = PICK[key][7:]
            i = flickr_info(pid)
            if not i.get('licence') or not i.get('url'):
                print('no licence or picture from Flickr:', key, pid, file=sys.stderr)
                continue
            raw = os.path.join(CACHE, f'raw-{slug(key)}-flickr-{pid}.jpg')
            if not done and not fetch(i['url'], raw):
                continue
            tag = hashlib.sha1(json.dumps([pid, i['url'], CROP.get(key), W, H, S]).encode()).hexdigest()[:10]
            src = os.path.join(CACHE, f'crop-{slug(key)}-{tag}.png')
            if not os.path.exists(src) and not done:
                crop(raw, src, CROP.get(key))
            row = [stem, f'flickr:{i["owner"]}/{pid}', plain(i['author'])[:120], i['licence'], i['licenceUrl'], YEAR.get(key) or i['year'] or 0]
        elif key in PICK:
            f = PICK[key]
            i = file_info(f.replace(' ', '_'))
            if not i or not i['licence']:
                print('no licence found:', key, f, file=sys.stderr)
                continue
            width = min(1600, i['w'] or 1600)
            raw = os.path.join(CACHE, f'raw-{slug(key)}-{width}.jpg')
            if not done and not fetch(thumb(i['file'], width), raw):
                continue
            # (the crop and its mask are named for what made them, so a new pick or crop makes them again)
            tag = hashlib.sha1(json.dumps([i['file'], width, CROP.get(key), W, H, S]).encode()).hexdigest()[:10]
            src = os.path.join(CACHE, f'crop-{slug(key)}-{tag}.png')
            if not os.path.exists(src) and not done:
                crop(raw, src, CROP.get(key))
            row = [stem, i['file'], plain(i['author'])[:120], i['licence'], i['licenceUrl'], YEAR.get(key) or i['year'] or 0]
        else:
            continue
        mask = os.path.join(CACHE, f'mask-{slug(key)}-{tag}.png')
        band = next((b for k, b in BAND.items() if e and k in e[3]), CARD_KEEP) if e else None
        if e and CLEAR.get(key, {}).get('band'):
            band = CLEAR[key]['band']
        todo.append((key, src, mask, os.path.join(CACHE, f'sam-{slug(key)}-{tag}.png'), band, stem, done))
        rows.append(f"  {json.dumps(key)}: {json.dumps(row, ensure_ascii=False)}, // {players[key][0]}")
    return rows, todo, players


def crops():
    """The crops on contact sheets (.cache/action/crops-NN.jpg), to check by eye before the cut-out."""
    from PIL import Image, ImageDraw
    _, todo, players = prepare()
    for n in range(0, len(todo), 30):
        sheet = Image.new('RGB', (10 * 150, 3 * 185), 'white')
        d = ImageDraw.Draw(sheet)
        for i, (key, src, *_) in enumerate(t for t in todo[n:n + 30] if os.path.exists(t[1])):
            x, y = i % 10 * 150, i // 10 * 185
            sheet.paste(Image.open(src).convert('RGB').resize((140, 154)), (x, y))
            d.text((x, y + 157), f'{key} {players[key][0]}'[:24], fill='black')
        sheet.save(os.path.join(CACHE, f'crops-{n // 30:02d}.jpg'), quality=80)
    print(f'{len(todo)} crops on {(len(todo) + 29) // 30} sheets', file=sys.stderr)


def build():
    os.makedirs(IMG, exist_ok=True)
    rows, todo, players = prepare()
    # (only what isn't cut out yet: a finished picture is never made again under the same name)
    masks([(c, m, q) for _, c, m, q, _, _, done in todo if not done], {q: SAM_HINT[k] for k, _, _, q, *_ in todo if k in SAM_HINT})
    for key, src, mask, sam, card, stem, done in todo:
        if not done:
            cutout(src, mask, os.path.join(IMG, stem + '.webp'), None if key in ALONE else sam, card, key in SAM_HINT,
                   CLEAR.get(key, {}).get('cut'), INK.get(key))
    keep = {stem + '.webp' for *_, stem, _ in todo}
    for old in os.listdir(IMG):
        if old not in keep:
            os.remove(os.path.join(IMG, old))
    js = open(JS, encoding='utf-8').read()
    a, b = js.index('// <action-photos>'), js.index('// </action-photos>')
    js = js[:a] + '// <action-photos> (written by tools/dynasty/action_photos.py)\nexport const ACTION = {\n' + '\n'.join(rows) + '\n};\n' + js[b:]
    open(JS, 'w', encoding='utf-8').write(js)
    print(f'{len(rows)} of {len(players)} players (Rare+ and Legends) have an action photo, {sum(1 for t in todo if t[4] is not None)} from their trading cards, {sum(1 for t in todo if not t[6])} cut out now', file=sys.stderr)


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
    {'find': find, 'merge': merge, 'crops': crops, 'build': build}[sys.argv[1] if len(sys.argv) > 1 else 'find']()
