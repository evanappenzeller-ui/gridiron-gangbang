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
ALONE = {'0034856', 'xbrettfavre', 'xjohnnyunitas', '0034790', '0036442', '0038542', 'xpeytonmanning', 'xkenhouston', 'xmikehaynes', 'xlougroza', 'xforrestgregg', 'xmikeditka', 'xlarrycsonka', 'xearlcampbell', 'xbuckbuchanan', 'xwilliebrown', 'xtimbrown', 'xderrickbrooks', 'xraymondberry', 'xbobbybell', 'xchuckbednarik', 'xmichaelirvin', 'xherbadderley', 'xtroyaikman', 'xmortenandersen', 'xbojackson', 'xdicknighttrain', 'xjohnmackey', 'xemlentunnell', 'xdanmarino', 'xanthonymuñoz', 'xalanpage', 'xjimparker', 'xleeroyselmon', 'xmichaelstrahan', 'xbrianurlacher', 'xsteveyoung', 'xlarryallen', '0039338', 'xmerlinolsen', 'xjohnelway', 'xmarshallfaulk', 'xjohnhannah', 'xsamhuff', 'xwalterjones', 'xjimkelly', 'xwillielanier', 'xcurtismartin', '0031279', '0037744', '0033280', '0036388', 'xterrellowens', 'xjohnrandle', 'xjerryrice', 'xjjwatt', 'xlawrencetaylor'}  # Denzel Ward, Brett Favre, Johnny Unitas, Derwin James
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
    'xericdickerson': {'cut': [[(0.9, 0.77), (1, 0.75), (1, 1), (0.89, 1), (0.89, 0.9)]]},  # Eric Dickerson
    'xjacklambert': {'cut': [[(0, 0.4), (0.07, 0.4), (0.07, 0.72), (0, 0.72)], [(0, 0.76), (0.12, 0.76), (0.17, 0.86), (0.17, 1), (0, 1)]]},  # Jack Lambert
    'xartmonk': {'cut': [[(0.53, 0.475), (0.56, 0.47), (0.64, 0.465), (0.675, 0.5), (0.675, 0.6), (0.7, 0.615), (0.74, 0.625), (0.74, 0.86), (0.34, 0.86), (0.345, 0.787), (0.39, 0.787), (0.43, 0.793), (0.45, 0.793), (0.455, 0.78), (0.475, 0.75), (0.49, 0.72), (0.505, 0.69), (0.525, 0.65), (0.53, 0.6)], [(0.72, 0.77), (0.9, 0.77), (0.9, 0.87), (0.72, 0.87)], [(0.09, 0.06), (0.29, 0.06), (0.29, 0.22), (0.09, 0.22)]], 'band': (0.08, 0.03, 0.86, 0.84)},  # Art Monk
    'xbarrysanders': {'cut': [[(0, 0), (0.99, 0), (0.99, 0.14), (0.66, 0.14), (0.66, 0.08), (0.46, 0.08), (0.46, 0.14), (0, 0.14)], [(0.74, 0), (0.99, 0), (0.99, 0.6), (0.905, 0.6), (0.905, 0.47), (0.88, 0.42), (0.87, 0.34), (0.82, 0.3), (0.8, 0.26), (0.76, 0.21), (0.74, 0.19)], [(0.81, 0.595), (0.99, 0.595), (0.99, 0.87), (0.7, 0.87), (0.7, 0.835), (0.805, 0.835), (0.805, 0.68), (0.81, 0.68)], [(0.765, 0.705), (0.805, 0.705), (0.805, 0.74), (0.765, 0.74)]], 'band': (0.06, 0.07, 0.99, 0.84)},  # Barry Sanders
}
# An autograph in ink across a photo (Gale Sayers' signed print): the ink's hue range (OpenCV's 0-179 scale) is painted out
# before the cut-out (ink_out: the ink's strokes found by hue and saturation, filled from round them, their colour neutral)
INK = {'xgalesayers': (110, 132)}  # Gale Sayers: a blue signature across his legs
# The year a Commons photo was taken, where its page gives none or its upload date instead
YEAR = {'xraylewis': 2007, 'xjohnnyunitas': 1963}
# The owner's own photos ('own:<file>' in PICK), collected by hand from his checklist of players without one
OWN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'photos')
# ...whose figure is wider than the window: padded with white above, so the whole figure fits (see flatten())
PAD = {'xkenhouston', 'xlougroza', 'xforrestgregg', 'xbuckbuchanan', 'xwilliebrown', 'xtimbrown', 'xherbadderley', 'xmortenandersen', 'xdeaconjones', 'xemlentunnell', 'xanthonymuñoz', 'xalanpage', 'xleeroyselmon', 'xmichaelstrahan', 'xderrickthomas', 'xthurmanthomas', 'xbrianurlacher', 'xlarrywilson', 'xsteveyoung', '0039172', '0039840', '0039141', '0036963', '0034495', '0034752', '0032378', '0037248', 'xmarshallfaulk', 'xjohnhannah', 'xwalterjones', 'xjimkelly', 'xpaulkrause', 'xcurtismartin', '0033280', 'xterrellowens', 'xjohnrandle', '0039163', 'xrodwoodson', 'xlawrencetaylor'}
# Players whose picture was redone since VERSION (a new pick, card or crop): their own version in the file name, so only
# they are rebuilt and fetched again; build leaves every other player's finished picture as it is
REDO = {
    'xraylewis': 'v4', 'xtombrady': 'v4', '0036358': 'v4', '0033288': 'v4', '0034856': 'v4', '0037250': 'v4',
    'xbrettfavre': 'v4', 'xaarondonald': 'v4', '0037236': 'v4',
    'xjohnnyunitas': 'v4', 'xgalesayers': 'v4',
    'xartmonk': 'v4', 'xbarrysanders': 'v4', 'xdanfouts': 'v5', 'xericdickerson': 'v4', 'xfrancoharris': 'v5', 'xjacklambert': 'v4', 'xlancealworth': 'v5', 'xpaulkrause': 'v5', 'xwalterjones': 'v5',  # Legends: card remnants cleared by hand
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
    'xkenhouston': 'v4',  # Ken Houston: his own photo (tools/dynasty/photos)
    'xmikehaynes': 'v4',  # Mike Haynes: his own photo (tools/dynasty/photos)
    'xlougroza': 'v4',  # Lou Groza: his own photo (tools/dynasty/photos)
    'xforrestgregg': 'v4',  # Forrest Gregg: his own photo (tools/dynasty/photos)
    'xmikeditka': 'v5',  # Mike Ditka: his own photo (tools/dynasty/photos)
    'xlarrycsonka': 'v4',  # Larry Csonka: his own photo (tools/dynasty/photos)
    'xearlcampbell': 'v4',  # Earl Campbell: his own photo (tools/dynasty/photos)
    'xbuckbuchanan': 'v4',  # Buck Buchanan: his own photo (tools/dynasty/photos)
    'xwilliebrown': 'v4',  # Willie Brown: his own photo (tools/dynasty/photos)
    'xtimbrown': 'v4',  # Tim Brown: his own photo (tools/dynasty/photos)
    'xderrickbrooks': 'v4',  # Derrick Brooks: his own photo (tools/dynasty/photos)
    'xmelblount': 'v4',  # Mel Blount: his own photo (tools/dynasty/photos)
    'xraymondberry': 'v4',  # Raymond Berry: his own photo (tools/dynasty/photos)
    'xbobbybell': 'v4',  # Bobby Bell: his own photo (tools/dynasty/photos)
    'xchuckbednarik': 'v4',  # Chuck Bednarik: his own photo (tools/dynasty/photos)
    'xmichaelirvin': 'v4',  # Michael Irvin: his own photo (tools/dynasty/photos)
    'xherbadderley': 'v4',  # Herb Adderley: his own photo (tools/dynasty/photos)
    'xtroyaikman': 'v4',  # Troy Aikman: his own photo (tools/dynasty/photos)
    'xmortenandersen': 'v4',  # Morten Andersen: his own photo (tools/dynasty/photos)
    'xbojackson': 'v1',  # Bo Jackson: his own photo (tools/dynasty/photos)
    'xdeaconjones': 'v1',  # Deacon Jones: his own photo (tools/dynasty/photos)
    'xsonnyjurgensen': 'v1',  # Sonny Jurgensen: his own photo (tools/dynasty/photos)
    'xdicknighttrain': 'v1',  # Dick "Night Train" Lane: his own photo (tools/dynasty/photos)
    'xstevelargent': 'v1',  # Steve Largent: his own photo (tools/dynasty/photos)
    'xjohnmackey': 'v1',  # John Mackey: his own photo (tools/dynasty/photos)
    'xemlentunnell': 'v2',  # Emlen Tunnell: his own photo (tools/dynasty/photos)
    'xlawrencetaylor': 'v4',  # Lawrence Taylor: his own photo (tools/dynasty/photos)
    '0035248': 'v4',  # Zach Allen: his own photo (tools/dynasty/photos)
    '0031364': 'v4',  # Jadeveon Clowney: his own photo (tools/dynasty/photos)
    '0039491': 'v4',  # Jalen Coker: his own photo (tools/dynasty/photos)
    '0036554': 'v4',  # Nico Collins: his own photo (tools/dynasty/photos)
    '0037248': 'v4',  # James Cook: his own photo (tools/dynasty/photos)
    '0035699': 'v4',  # Jamel Dean: his own photo (tools/dynasty/photos)
    '0039841': 'v4',  # Cooper DeJean: his own photo (tools/dynasty/photos)
    'xjohnelway': 'v4',  # John Elway: his own photo (tools/dynasty/photos)
    '0032726': 'v4',  # Ka'imi Fairbairn: his own photo (tools/dynasty/photos)
    'xmarshallfaulk': 'v4',  # Marshall Faulk: his own photo (tools/dynasty/photos)
    '0039064': 'v4',  # Zay Flowers: his own photo (tools/dynasty/photos)
    'xtonygonzalez': 'v4',  # Tony Gonzalez: his own photo (tools/dynasty/photos)
    'xdarrellgreen': 'v4',  # Darrell Green: his own photo (tools/dynasty/photos)
    'xrobgronkowski': 'v4',  # Rob Gronkowski: his own photo (tools/dynasty/photos)
    '0038038': 'v4',  # Kyle Hamilton: his own photo (tools/dynasty/photos)
    'xjohnhannah': 'v4',  # John Hannah: his own photo (tools/dynasty/photos)
    '0032764': 'v4',  # Derrick Henry: his own photo (tools/dynasty/photos)
    '0036564': 'v4',  # Talanoa Hufanga: his own photo (tools/dynasty/photos)
    'xsamhuff': 'v4',  # Sam Huff: his own photo (tools/dynasty/photos)
    '0031565': 'v4',  # Danielle Hunter: his own photo (tools/dynasty/photos)
    'xjimkelly': 'v4',  # Jim Kelly: his own photo (tools/dynasty/photos)
    'xwillielanier': 'v4',  # Willie Lanier: his own photo (tools/dynasty/photos)
    '0039065': 'v4',  # Sam LaPorta: his own photo (tools/dynasty/photos)
    '0039343': 'v4',  # Kamari Lassiter: his own photo (tools/dynasty/photos)
    '0037838': 'v4',  # Isaiah Likely: his own photo (tools/dynasty/photos)
    'xboblilly': 'v4',  # Bob Lilly: his own photo (tools/dynasty/photos)
    '0037238': 'v4',  # Drake London: his own photo (tools/dynasty/photos)
    'xronnielott': 'v4',  # Ronnie Lott: his own photo (tools/dynasty/photos)
    '0034974': 'v4',  # Julian Love: his own photo (tools/dynasty/photos)
    'xcurtismartin': 'v4',  # Curtis Martin: his own photo (tools/dynasty/photos)
    '0031279': 'v4',  # Jake Matthews: his own photo (tools/dynasty/photos)
    '0039851': 'v4',  # Drake Maye: his own photo (tools/dynasty/photos)
    '0037744': 'v4',  # Trey McBride: his own photo (tools/dynasty/photos)
    '0033280': 'v4',  # Christian McCaffrey: his own photo (tools/dynasty/photos)
    '0036388': 'v4',  # Xavier McKinney: his own photo (tools/dynasty/photos)
    '0035358': 'v4',  # Chase McLaughlin: his own photo (tools/dynasty/photos)
    '0036624': 'v4',  # Alim McNeill: his own photo (tools/dynasty/photos)
    '0039888': 'v4',  # Quinyon Mitchell: his own photo (tools/dynasty/photos)
    '0035236': 'v4',  # Byron Murphy: his own photo (tools/dynasty/photos)
    '0039309': 'v4',  # Byron Murphy II: his own photo (tools/dynasty/photos)
    '0039075': 'v4',  # Puka Nacua: his own photo (tools/dynasty/photos)
    'xraynitschke': 'v4',  # Ray Nitschke: his own photo (tools/dynasty/photos)
    '0034158': 'v4',  # Brian O'Neill: his own photo (tools/dynasty/photos)
    '0037239': 'v4',  # Chris Olave: his own photo (tools/dynasty/photos)
    '0035230': 'v4',  # Ed Oliver: his own photo (tools/dynasty/photos)
    'xterrellowens': 'v4',  # Terrell Owens: his own photo (tools/dynasty/photos)
    '0037834': 'v4',  # Brock Purdy: his own photo (tools/dynasty/photos)
    'xjohnrandle': 'v4',  # John Randle: his own photo (tools/dynasty/photos)
    '0039404': 'v4',  # Will Reichard: his own photo (tools/dynasty/photos)
    'xjerryrice': 'v4',  # Jerry Rice: his own photo (tools/dynasty/photos)
    'xjuniorseau': 'v4',  # Junior Seau: his own photo (tools/dynasty/photos)
    '0036500': 'v4',  # Jamien Sherwood: his own photo (tools/dynasty/photos)
    '0031898': 'v4',  # Alex Singleton: his own photo (tools/dynasty/photos)
    '0038543': 'v4',  # Jaxon Smith-Njigba: his own photo (tools/dynasty/photos)
    '0032965': 'v4',  # Ronnie Stanley: his own photo (tools/dynasty/photos)
    '0034668': 'v4',  # Aaron Stinnie: his own photo (tools/dynasty/photos)
    '0039163': 'v4',  # C.J. Stroud: his own photo (tools/dynasty/photos)
    '0041528': 'v4',  # Michael Taaffe: his own photo (tools/dynasty/photos)
    'xfrantarkenton': 'v4',  # Fran Tarkenton: his own photo (tools/dynasty/photos)
    '0036223': 'v4',  # Jonathan Taylor: his own photo (tools/dynasty/photos)
    '0039852': 'v4',  # Jared Verse: his own photo (tools/dynasty/photos)
    'xkurtwarner': 'v4',  # Kurt Warner: his own photo (tools/dynasty/photos)
    '0037228': 'v4',  # Jaylen Warren: his own photo (tools/dynasty/photos)
    '0040128': 'v4',  # Tyler Warren: his own photo (tools/dynasty/photos)
    '0038124': 'v4',  # Christian Watson: his own photo (tools/dynasty/photos)
    'xjjwatt': 'v4',  # J.J. Watt: his own photo (tools/dynasty/photos)
    '0040148': 'v4',  # Xavier Watts: his own photo (tools/dynasty/photos)
    'xrandywhite': 'v4',  # Randy White: his own photo (tools/dynasty/photos)
    'xreggiewhite': 'v4',  # Reggie White: his own photo (tools/dynasty/photos)
    '0037240': 'v4',  # Jameson Williams: his own photo (tools/dynasty/photos)
    '0031933': 'v4',  # Leonard Williams: his own photo (tools/dynasty/photos)
    'xcharleswoodson': 'v4',  # Charles Woodson: his own photo (tools/dynasty/photos)
    'xrodwoodson': 'v4',  # Rod Woodson: his own photo (tools/dynasty/photos)
    '0033831': 'v4',  # Andrew Wylie: his own photo (tools/dynasty/photos)
    '0039137': 'v4',  # Byron Young: his own photo (tools/dynasty/photos)
    'xdanmarino': 'v1',  # Dan Marino: his own photo (tools/dynasty/photos)
    'xdonmaynard': 'v1',  # Don Maynard: his own photo (tools/dynasty/photos)
    'xanthonymuñoz': 'v1',  # Anthony Muñoz: his own photo (tools/dynasty/photos)
    'xmerlinolsen': 'v1',  # Merlin Olsen: his own photo (tools/dynasty/photos)
    'xjimotto': 'v1',  # Jim Otto: his own photo (tools/dynasty/photos)
    'xalanpage': 'v1',  # Alan Page: his own photo (tools/dynasty/photos)
    'xjimparker': 'v1',  # Jim Parker: his own photo (tools/dynasty/photos)
    'xleeroyselmon': 'v1',  # Lee Roy Selmon: his own photo (tools/dynasty/photos)
    '0039846': 'v1',  # Tykee Smith: his own photo (tools/dynasty/photos)
    'xjanstenerud': 'v1',  # Jan Stenerud: his own photo (tools/dynasty/photos)
    'xmichaelstrahan': 'v1',  # Michael Strahan: his own photo (tools/dynasty/photos)
    '0034399': 'v1',  # Wyatt Teller: his own photo (tools/dynasty/photos)
    'xderrickthomas': 'v1',  # Derrick Thomas: his own photo (tools/dynasty/photos)
    'xthurmanthomas': 'v1',  # Thurman Thomas: his own photo (tools/dynasty/photos)
    'xgeneupshaw': 'v1',  # Gene Upshaw: his own photo (tools/dynasty/photos)
    'xbrianurlacher': 'v1',  # Brian Urlacher: his own photo (tools/dynasty/photos)
    'xmikewebster': 'v1',  # Mike Webster: his own photo (tools/dynasty/photos)
    'xlarrywilson': 'v1',  # Larry Wilson: his own photo (tools/dynasty/photos)
    'xsteveyoung': 'v1',  # Steve Young: his own photo (tools/dynasty/photos)
    '0039371': 'v4',  # Kris Abrams-Draine: his own photo (tools/dynasty/photos)
    'xlarryallen': 'v4',  # Larry Allen: his own photo (tools/dynasty/photos)
    '0039108': 'v4',  # Will Anderson Jr.: his own photo (tools/dynasty/photos)
    'xsteveatwater': 'v4',  # Steve Atwater: his own photo (tools/dynasty/photos)
    '0039172': 'v4',  # Jake Bates: his own photo (tools/dynasty/photos)
    '0034675': 'v4',  # Jessie Bates: his own photo (tools/dynasty/photos)
    '0038560': 'v4',  # Jordan Battle: his own photo (tools/dynasty/photos)
    '0036418': 'v4',  # Zack Baun: his own photo (tools/dynasty/photos)
    '0039840': 'v4',  # Austin Booker: his own photo (tools/dynasty/photos)
    '0039338': 'v4',  # Brock Bowers: his own photo (tools/dynasty/photos)
    'xterrybradshaw': 'v4',  # Terry Bradshaw: his own photo (tools/dynasty/photos)
    '0039141': 'v4',  # Brian Branch: his own photo (tools/dynasty/photos)
    '0036409': 'v4',  # Jordyn Brooks: his own photo (tools/dynasty/photos)
    '0035676': 'v4',  # A.J. Brown: his own photo (tools/dynasty/photos)
    '0036963': 'v4',  # Amon-Ra St. Brown: his own photo (tools/dynasty/photos)
    '0036220': 'v4',  # Derrick Brown: his own photo (tools/dynasty/photos)
    '0034495': 'v4',  # Evan Brown: his own photo (tools/dynasty/photos)
    '0034752': 'v4',  # Orlando Brown: his own photo (tools/dynasty/photos)
    '0032071': 'v4',  # Trent Brown: his own photo (tools/dynasty/photos)
    'xdickbutkus': 'v4',  # Dick Butkus: his own photo (tools/dynasty/photos)
    '0033132': 'v4',  # Kevin Byard: his own photo (tools/dynasty/photos)
    '0039018': 'v4',  # Jack Campbell: his own photo (tools/dynasty/photos)
    '0036974': 'v4',  # Tyson Campbell: his own photo (tools/dynasty/photos)
    '0032378': 'v4',  # DeForest Buckner: his own photo (tools/dynasty/photos)
    '0039838': 'v4',  # Calen Bullock: his own photo (tools/dynasty/photos)
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
    '0039371', 'xlarryallen', 'xlancealworth', '0039108', 'xsteveatwater', '0039172', '0034675', '0038560', '0036418', '0039840', '0039338', 'xterrybradshaw', '0039141', '0036409', '0035676', '0036963', '0036220', '0034495', '0034752', '0032071', 'xdickbutkus', '0033132', '0039018', '0036974', '0032378', '0039838',  # his own photos (Nov 3 2026): Kris Abrams-Draine, Larry Allen, Lance Alworth, Will Anderson Jr., Steve Atwater, Jake Bates, Jessie Bates, Jordan Battle, Zack Baun, Austin Booker, Brock Bowers, Terry Bradshaw, Brian Branch, Jordyn Brooks, A.J. Brown, Amon-Ra St. Brown, Derrick Brown, Evan Brown, Orlando Brown, Trent Brown, Dick Butkus, Kevin Byard, Jack Campbell, Tyson Campbell, DeForest Buckner, Calen Bullock
    '0031364', '0039491', '0036554', '0037248', '0035699', '0039841',  # Jadeveon Clowney, Jalen Coker, Nico Collins, James Cook, Jamel Dean, Cooper DeJean
    'xjohnelway', '0032726', 'xmarshallfaulk', '0039064', 'xdanfouts', 'xtonygonzalez',  # John Elway, Ka'imi Fairbairn, Marshall Faulk, Zay Flowers, Dan Fouts, Tony Gonzalez
    'xdarrellgreen', 'xrobgronkowski', '0038038', 'xjohnhannah', 'xfrancoharris', '0032764', '0036564',  # Darrell Green, Rob Gronkowski, Kyle Hamilton, John Hannah, Franco Harris, Derrick Henry, Talanoa Hufanga
    'xsamhuff', '0031565', 'xwalterjones', 'xjimkelly', 'xpaulkrause', 'xwillielanier',  # Sam Huff, Danielle Hunter, Walter Jones, Jim Kelly, Paul Krause, Willie Lanier
    '0039065', '0039343', '0037838', 'xboblilly', '0037238',  # Sam LaPorta, Kamari Lassiter, Isaiah Likely, Bob Lilly, Drake London
    'xronnielott', '0034974', 'xcurtismartin', '0031279', '0039851',  # Ronnie Lott, Julian Love, Curtis Martin, Jake Matthews, Drake Maye
    '0037744', '0033280', '0036388', '0035358', '0036624', '0039888',  # Trey McBride, Christian McCaffrey, Xavier McKinney, Chase McLaughlin, Alim McNeill, Quinyon Mitchell
    '0035236', '0039309', '0039075',  # Byron Murphy, Byron Murphy II, Puka Nacua
    'xraynitschke', '0034158', '0037239', '0035230', 'xterrellowens',  # Ray Nitschke, Brian O'Neill, Chris Olave, Ed Oliver, Terrell Owens
    '0037834', 'xjohnrandle', '0039404', 'xjerryrice',  # Brock Purdy, John Randle, Will Reichard, Jerry Rice
    'xjuniorseau', '0036500',  # Junior Seau, Jamien Sherwood
    '0031898', '0038543', '0032965', '0034668', '0039163',  # Alex Singleton, Jaxon Smith-Njigba, Ronnie Stanley, Aaron Stinnie, C.J. Stroud
    '0041528', 'xfrantarkenton', '0036223', '0039852',  # Michael Taaffe, Fran Tarkenton, Jonathan Taylor, Jared Verse
    'xkurtwarner', '0037228', '0040128', '0038124', 'xjjwatt', '0040148', 'xrandywhite',  # Kurt Warner, Jaylen Warren, Tyler Warren, Christian Watson, J.J. Watt, Xavier Watts, Randy White
    'xreggiewhite', '0037240', '0031933', 'xcharleswoodson', 'xrodwoodson',  # Reggie White, Jameson Williams, Leonard Williams, Charles Woodson, Rod Woodson
    '0033831', '0039137',  # Andrew Wylie, Byron Young  (his own photos, Nov 3 2026)
    'xlawrencetaylor', '0035248',  # Lawrence Taylor, Zach Allen  (his own photos, Nov 4 2026)
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
    "0035248": "own:0035248.jpg",  # Zach Allen, Broncos #99 (his own photo)
    "xtombrady": "Tom_Brady_(2).jpg",  # Tom Brady, a Patriots pass (the Buccaneers crop stopped at his chest)
    "xjimbrown": "Jim_Brown_1959_Topps_cropped_and_recoloured.jpg",  # Jim Brown, 1959
    "xpeytonmanning": "flickr:5043838891",  # Peyton Manning, 2010, warming up, helmet in hand
    "xaarondonald": "Aaron_Donald_2020.jpg",  # Aaron Donald, 2020, the whole photo (the crop stopped at his chest)
    "xjoemontana": "1986_Jeno's_Pizza_-_28_-_Roger_Craig_(Joe_Montana_crop).jpg",  # Joe Montana, 1985
    "xjohnnyunitas": "Unitas-Johnny-1963.jpg",  # Johnny Unitas, 1963, set to pass (the 1958 Topps card was painted)
    "xrandymoss": "Randy_Moss_with_Vikings.jpg",  # Randy Moss, with the Vikings, 2010
    "xraylewis": "Ray_Lewis_2007.jpg",  # Ray Lewis, 2007 (alone, the whole of him; the 2008 game photo had a Steeler in it)
    "xcalvinjohnson": "Calvin_Johnson_vs_Green_Bay.jpg",  # Calvin Johnson, at Green Bay
    "xedreed": "Ed_reed_ravens2012.jpg",  # Ed Reed, 2012
    "xgalesayers": "Gale_sayers_playing.jpg",  # Gale Sayers, 1972
    "xladainiantomli": "Tomlinson_warming_up_1.jpg",  # LaDainian Tomlinson, warming up with the ball
    "xbrettfavre": "David_Martin82_Brett_Favre4-Edit2.jpg",  # Brett Favre, a Packers pass (the 1998 photo was on the sideline in a cap)
    "xdrewbrees": "New_Orleans_Saints_Quarterback,_Drew_Brees_(23262414434)_(cropped).jpg",  # Drew Brees, 2013
    "xericdickerson": "1985_Police_Raiders-Rams_-_20_Eric_Dickerson_(crop).jpg",  # Eric Dickerson, 1984
    "xjacklambert": "Jack_Lambert_in_December_1975.JPG",  # Jack Lambert, 1975
    "xrogerstaubach": "Staubach_cowboys_qb.jpg",  # Roger Staubach, 1976
    "xtroypolamalu": "Troy_Polamalu_2013_(cropped).jpg",  # Troy Polamalu, 2013
    "xadrianpeterson": "Adrian_Peterson_Vikings.jpg",  # Adrian Peterson, 2012
    "xbartstarr": "Bart_Starr_1958.jpg",  # Bart Starr, 1958
    "xchampbailey": "Champ_Bailey_2010.JPG",  # Champ Bailey, 2010
    "xginomarchetti": "Gino_Marchetti_1961.jpg",  # Gino Marchetti, 1961
    "xjackham": "JackHamPIT.png",  # Jack Ham, 1982
    "xjoenamath": "1986_Jeno's_Pizza_-_37_-_Joe_Namath_(Joe_Namath_crop).jpg",  # Joe Namath, 1969
    "xmarvinharrison": "Marvin_Harrison_in_2007_Training_Camp_2.jpg",  # Marvin Harrison, 2008
    "xbriandawkins": "Brian_Dawkins.JPG",  # Brian Dawkins, 2009
    "xjustintucker": "flickr:50425638927",  # Justin Tucker, 2020, kicking at Washington
    "xmarcusallen": "1985_Police_Raiders-Rams_-_01_Marcus_Allen_(crop).jpg",  # Marcus Allen, 1984
    "xlembarney": "LemBarneyDET.png",  # Lem Barney, 1968
    "xlendawson": "Kansas_City_Chiefs_at_Denver_Broncos_1985-12-14_(ticket)_(crop).jpg",  # Len Dawson, 1970
    "0027857": "Trent_Willams_2020_(cropped).jpg",  # Trent Williams, 2020
    "0034857": "Josh_Allen_(30419600128).jpg",  # Josh Allen, 2018, a pass at Cleveland
    "0037236": "Commanders_at_Lions_(52379162544).jpg",  # Aidan Hutchinson, 2022, celebrating a play (the old photo was on the bench, no helmet)
    "0037841": "2025_Rams_vs_Titans_Quentin_Lake.png",  # Quentin Lake, 2025
    "0029592": "Kevin_Zeitler.JPG",  # Kevin Zeitler, 2015
    "0034973": "Maxx_Crosby_WFT-Raiders_DEC2021.jpg",  # Maxx Crosby, 2021, kneeling on the field
    "0030097": "David_Quessenberry_2021_09-19.jpg",  # David Quessenberry, 2021
    "0033886": "TJ_Watt.jpg",  # T.J. Watt, 2019, at Cleveland
    "0035643": "2026_Tennessee_Titans_New_Jersey_Photo_Shoot_-_Jeffery_Simmons_(cropped).png",  # Jeffery Simmons, 2026
    "0030561": "Eagles_at_Redskins_2017.jpg",  # Lane Johnson, 2017
    "0036358": "Washington_at_Dallas_Photo_110_(51787382465).jpg",  # CeeDee Lamb, 2021, alone with the ball (his card had a defender on him)
    "0031330": "NFL_2020_-_Playoffs_-_Washington_vs._Buccaneers_209_(50833182757).jpg",  # Morgan Moses, 2021
    "0034351": "Dallas_Goedert.jpg",  # Dallas Goedert, 2019, running in at Washington
    "0036900": "Commanders_vs._Bengals_-_54752531474.jpg",  # Ja'Marr Chase, 2025
    "0032234": "Laken_Tomlinson_with_49ers.jpg",  # Laken Tomlinson, 2017
    "0032391": "Joe_Thuney.JPG",  # Joe Thuney, 2017
    "0032445": "Ted_Karras_(offensive_lineman).JPG",  # Ted Karras, 2016
    "0033288": "49ers_at_Redskins_2019,_George_Kittle_(48933294286).jpg",  # George Kittle, 2019, running (the crop was his head and chest, no helmet)
    "0034815": "Fred_Warner_49ers_2018_(cropped).jpg",  # Fred Warner, 2018
    "0033281": "Marlon_Humphrey_Baltimore_Ravens_2021_(cropped).jpg",  # Marlon Humphrey, 2021
    "0037191": "Washington_Commanders_at_Kansas_City_Chiefs_(55091195803).jpg",  # Trent McDuffie, 2026
    "0039813": "Evan_Williams_(safety).jpg",  # Evan Williams, 2025
    "0033082": "Lucas_Patrick_(Green_Bay_Packers_player)_during_pre-season_game_against_Washington_Redskins_on_August_19,_2017_in_Maryland.jpg",  # Lucas Patrick, 2017
    "0035642": "Commanders_vs._Jaguars_(52377888202).jpg",  # Josh Hines-Allen, 2022
    "0036410": "Commanders_vs._Bengals_-_54752649825.jpg",  # Tee Higgins, 2025
    "0039111": "Tuli_Tuipulotu.jpg",  # Tuli Tuipulotu, 2025
    "0039337": "Commanders_vs._Giants_2025_20.jpg",  # Malik Nabers, 2025, airborne at Washington
    # (Oct 31 2026: the Rare and better cards' players without one yet; a college game where no NFL photo was free)
    "0038542": "Bijan_Robinson_2025.jpg",  # Bijan Robinson, 2025, off the snap (ALONE: Segment Anything carved his chest)
    "0038386": "Jalen_Carter.png",  # Jalen Carter, 2023
    "0031492": "Jason_Myers_-_51720303739_(cropped).jpg",  # Jason Myers, 2021
    "0033106": "Jared_Goff_2022.jpg",  # Jared Goff, 2022, alone on the field
    "0036997": "Javonte_WIlliams_2025.jpg",  # Javonte Williams, 2025, a carry for Dallas
    "0036442": "Joe_Burrow_Bengals.jpg",  # Joe Burrow, 2020, alone in the pocket
    "0036912": "Devonta_Smith_2022_(cropped).jpg",  # DeVonta Smith, 2022
    "0038996": "2025_Commanders_at_Packers_77.jpg",  # Tucker Kraft, 2025
    "0040122": "2025_Raiders_at_Commanders_106.jpg",  # Ashton Jeanty, 2025
    "0033131": "Maliek_Collins.jpg",  # Maliek Collins, 2017
    "0037692": "Brandon_Aubrey_10_1_2023.jpg",  # Brandon Aubrey, 2023
    "0034759": "Kolton_Miller_2025.jpg",  # Kolton Miller, 2025
    "0034856": "Denzel_Ward_(43775487861).jpg",  # Denzel Ward, 2018 camp, helmet on and the ball in hand
    "0036971": "Trevor_Lawrence_Commanders_vs_Jaguars_SEP2022.jpg",  # Trevor Lawrence, 2022, rolling out at Washington
    "0037250": "2022_Cleveland_Browns_Training_Camp_(52339586867).jpg",  # Martin Emerson, 2022 camp, running alone
    "0038563": "Tre_Tucker_(54841331175)_(cropped).jpg",  # Tre Tucker, 2025
    "0039067": "Rashee_Rice_(55090108907)_(cropped).jpg",  # Rashee Rice, 2026
    "0040579": "Carson_Schwesinger_2025_Browns_Camp_(cropped).jpg",  # Carson Schwesinger, 2025
    "0032762": "Chris_Jones_(defensive_tackle,_born_1994).JPG",  # Chris Jones, 2017
    "0033890": "Budda_Baker.JPG",  # Budda Baker, 2017
    "0034768": "Chukwuma_Okorafor_(50695534763)_(cropped).jpg",  # Chukwuma Okorafor, 2020
    "0034836": "Braden_Smith_at_Lambeau_Field.jpg",  # Braden Smith, 2024
    "0036322": "Jefferson_2022.jpg",  # Justin Jefferson, 2022
    "0039918": "Commanders_vs._Bears_(54857809842).jpg",  # Caleb Williams, 2025
    "0040663": "Harold_Fannin_Jr._3.jpg",  # Harold Fannin Jr., 2026, at Browns camp
    "0034796": "Lamar_Jackson_passing_2020_(cropped).jpg",  # Lamar Jackson, 2020
    "0023459": "AaronRodgersSteelers_(cropped).jpg",  # Aaron Rodgers, 2025
    "xjoethomas": "Joe_Thomas_Cleveland_Browns.jpg",  # Joe Thomas, 2011, at camp in his #73
    "0034790": "Derwin_James_-_2025_Commanders_at_Chargers.jpg",  # Derwin James, 2025, running out
    "0030506": "flickr:51614629582",  # Travis Kelce, 2021, running with the ball at Washington
    "xkenhouston": "own:xkenhouston.png",  # Ken Houston, Washington #27, with the ball (his own photo)
    "xmikehaynes": "own:xmikehaynes.png",  # Mike Haynes, Raiders #22, in his stance (his own photo)
    "xlougroza": "own:xlougroza.png",  # Lou Groza, Browns #76, kicking (his own photo)
    "xforrestgregg": "own:xforrestgregg.png",  # Forrest Gregg, Packers #75 (his own photo)
    "xmikeditka": "own:xmikeditka.jpg",  # Mike Ditka, Bears #89, with the ball (his own photo)
    "xlarrycsonka": "own:xlarrycsonka.jpg",  # Larry Csonka, Dolphins #39 (his own photo)
    "xearlcampbell": "own:xearlcampbell.jpg",  # Earl Campbell, Oilers #34, with the ball (his own photo)
    "xbuckbuchanan": "own:xbuckbuchanan.png",  # Buck Buchanan, Chiefs #86 (his own photo)
    "xwilliebrown": "own:xwilliebrown.png",  # Willie Brown, Raiders #24, with the ball (his own photo)
    "xtimbrown": "own:xtimbrown.jpg",  # Tim Brown, Raiders #81, a one-handed catch (his own photo)
    "xderrickbrooks": "own:xderrickbrooks.webp",  # Derrick Brooks, Buccaneers #55 (his own photo)
    "xmelblount": "own:xmelblount.jpg",  # Mel Blount, Steelers #47 (his own photo; Segment Anything for the referee behind)
    "xraymondberry": "own:xraymondberry.webp",  # Raymond Berry, Colts #82 (his own photo)
    "xbobbybell": "own:xbobbybell.webp",  # Bobby Bell, Chiefs #78 (his own photo)
    "xchuckbednarik": "own:xchuckbednarik.webp",  # Chuck Bednarik, Eagles #60, in his stance (his own photo)
    "xmichaelirvin": "own:xmichaelirvin.jpg",  # Michael Irvin, Cowboys #88, with the ball (his own photo)
    "xherbadderley": "own:xherbadderley.png",  # Herb Adderley, Packers #26 (his own photo)
    "xtroyaikman": "own:xtroyaikman.jpg",  # Troy Aikman, Cowboys #8, on the sideline (his own photo)
    "xmortenandersen": "own:xmortenandersen.png",  # Morten Andersen, Saints #7 (his own photo)
    "xbojackson": "own:xbojackson.jpg",  # Bo Jackson, in pads with a bat (his own photo)
    "xdeaconjones": "own:xdeaconjones.jpg",  # Deacon Jones, Rams #75 (his own photo)
    "xsonnyjurgensen": "own:xsonnyjurgensen.jpg",  # Sonny Jurgensen, Washington #9, set to throw (his own photo)
    "xdicknighttrain": "own:xdicknighttrain.jpg",  # Dick "Night Train" Lane, Lions #81 (his own photo)
    "xstevelargent": "own:xstevelargent.webp",  # Steve Largent, Seahawks #80, with the ball (his own photo)
    "xjohnmackey": "own:xjohnmackey.jpg",  # John Mackey, Colts #88 (his own photo)
    "xemlentunnell": "own:xemlentunnell.jpg",  # Emlen Tunnell, Giants #45 (his own photo)
    "0031364": "own:0031364.jpg",  # Jadeveon Clowney, Titans #99 (his own photo)
    "0039491": "own:0039491.jpg",  # Jalen Coker, Panthers #18 (his own photo)
    "0036554": "own:0036554.jpg",  # Nico Collins, Texans #12 (his own photo)
    "0037248": "own:0037248.webp",  # James Cook, Bills #4 (his own photo)
    "0035699": "own:0035699.jpg",  # Jamel Dean, Steelers #35 (his own photo)
    "0039841": "own:0039841.jpg",  # Cooper DeJean, Eagles #33 (his own photo)
    "xjohnelway": "own:xjohnelway.png",  # John Elway, Broncos #7 (his own photo)
    "0032726": "own:0032726.jpg",  # Ka'imi Fairbairn, Texans, kicking (his own photo)
    "xmarshallfaulk": "own:xmarshallfaulk.jpg",  # Marshall Faulk, Rams #28 (his own photo)
    "0039064": "own:0039064.webp",  # Zay Flowers, Ravens #4 (his own photo)
    "xdanfouts": "own:xdanfouts.jpg",  # Dan Fouts, Chargers #14 (his own photo)
    "xtonygonzalez": "own:xtonygonzalez.jpg",  # Tony Gonzalez, Chiefs #88 (his own photo)
    "xdarrellgreen": "own:xdarrellgreen.jpg",  # Darrell Green, Washington #28 (his own photo)
    "xrobgronkowski": "own:xrobgronkowski.jpg",  # Rob Gronkowski, Patriots #87 (his own photo)
    "0038038": "own:0038038.jpg",  # Kyle Hamilton, Ravens #14 (his own photo)
    "xjohnhannah": "own:xjohnhannah.jpg",  # John Hannah, Patriots #73 (his own photo)
    "xfrancoharris": "own:xfrancoharris.jpg",  # Franco Harris, Steelers #32 (his own photo)
    "0032764": "own:0032764.jpg",  # Derrick Henry, Ravens #22 (his own photo)
    "0036564": "own:0036564.jpg",  # Talanoa Hufanga, Broncos #9 (his own photo)
    "xsamhuff": "own:xsamhuff.jpg",  # Sam Huff, Giants #70 (his own photo)
    "0031565": "own:0031565.jpg",  # Danielle Hunter, Texans #55 (his own photo)
    "xwalterjones": "own:xwalterjones.jpg",  # Walter Jones, Seahawks #71 (his own photo)
    "xjimkelly": "own:xjimkelly.jpg",  # Jim Kelly, Bills #12 (his own photo)
    "xpaulkrause": "own:xpaulkrause.jpg",  # Paul Krause, Vikings #22 (his own photo)
    "xwillielanier": "own:xwillielanier.jpg",  # Willie Lanier, Chiefs #63 (his own photo)
    "0039065": "own:0039065.jpg",  # Sam LaPorta, Lions #87 (his own photo)
    "0039343": "own:0039343.jpg",  # Kamari Lassiter, Texans #4 (his own photo)
    "0037838": "own:0037838.jpg",  # Isaiah Likely, Giants #9 (his own photo)
    "xboblilly": "own:xboblilly.jpg",  # Bob Lilly, Cowboys #74 (his own photo)
    "0037238": "own:0037238.jpg",  # Drake London, Falcons #5, with the ball (his own photo)
    "xronnielott": "own:xronnielott.jpg",  # Ronnie Lott, 49ers #42 (his own photo)
    "0034974": "own:0034974.jpg",  # Julian Love, Seahawks #20 (his own photo)
    "xcurtismartin": "own:xcurtismartin.jpg",  # Curtis Martin, Jets #28, with the ball (his own photo)
    "0031279": "own:0031279.jpg",  # Jake Matthews, Falcons #70 (his own photo)
    "0039851": "own:0039851.jpg",  # Drake Maye, Patriots #10 (his own photo)
    "0037744": "own:0037744.jpg",  # Trey McBride, Cardinals #85 (his own photo)
    "0033280": "own:0033280.jpg",  # Christian McCaffrey, 49ers #23 (his own photo)
    "0036388": "own:0036388.jpg",  # Xavier McKinney, Packers #29 (his own photo)
    "0035358": "own:0035358.webp",  # Chase McLaughlin, Buccaneers #4 (his own photo)
    "0036624": "own:0036624.jpg",  # Alim McNeill, Lions #54 (his own photo)
    "0039888": "own:0039888.jpg",  # Quinyon Mitchell, Eagles #27 (his own photo)
    "0035236": "own:0035236.jpg",  # Byron Murphy, Vikings #7 (his own photo)
    "0039309": "own:0039309.jpg",  # Byron Murphy II, Seahawks #91 (his own photo)
    "0039075": "own:0039075.jpg",  # Puka Nacua, Rams #12 (his own photo)
    "xraynitschke": "own:xraynitschke.jpg",  # Ray Nitschke, Packers #66 (his own photo)
    "0034158": "own:0034158.jpg",  # Brian O'Neill, Vikings #75 (his own photo)
    "0037239": "own:0037239.jpg",  # Chris Olave, Saints #12 (his own photo)
    "0035230": "own:0035230.jpg",  # Ed Oliver, Bills #91 (his own photo)
    "xterrellowens": "own:xterrellowens.jpg",  # Terrell Owens, 49ers #81, with the ball (his own photo)
    "0037834": "own:0037834.jpg",  # Brock Purdy, 49ers #13 (his own photo)
    "xjohnrandle": "own:xjohnrandle.jpg",  # John Randle, Vikings #93 (his own photo)
    "0039404": "own:0039404.jpg",  # Will Reichard, Vikings #16 (his own photo)
    "xjerryrice": "own:xjerryrice.jpg",  # Jerry Rice, 49ers #80, with the ball (his own photo)
    "xjuniorseau": "own:xjuniorseau.jpg",  # Junior Seau, Patriots #55 (his own photo)
    "0036500": "own:0036500.jpg",  # Jamien Sherwood, Jets #44 (his own photo)
    "0031898": "own:0031898.jpg",  # Alex Singleton, Broncos #49 (his own photo)
    "0038543": "own:0038543.jpg",  # Jaxon Smith-Njigba, Seahawks #11, with the ball (his own photo)
    "0032965": "own:0032965.jpg",  # Ronnie Stanley, Ravens #79 (his own photo)
    "0034668": "own:0034668.jpg",  # Aaron Stinnie, Buccaneers #64 (his own photo)
    "0039163": "own:0039163.jpg",  # C.J. Stroud, Texans #7, throwing (his own photo)
    "0041528": "own:0041528.jpg",  # Michael Taaffe, Dolphins (his own photo)
    "xfrantarkenton": "own:xfrantarkenton.jpg",  # Fran Tarkenton, Vikings #10, with the ball (his own photo)
    "0036223": "own:0036223.jpg",  # Jonathan Taylor, Colts #28, with the ball (his own photo)
    "0039852": "own:0039852.jpg",  # Jared Verse, Browns #8 (his own photo)
    "xkurtwarner": "own:xkurtwarner.jpg",  # Kurt Warner, Cardinals #13, throwing (his own photo)
    "0037228": "own:0037228.jpg",  # Jaylen Warren, Steelers #30 (his own photo)
    "0040128": "own:0040128.jpg",  # Tyler Warren, Colts #84, with the ball (his own photo)
    "0038124": "own:0038124.jpg",  # Christian Watson, Packers #9 (his own photo)
    "xjjwatt": "own:xjjwatt.jpg",  # J.J. Watt, Texans #99 (his own photo)
    "0040148": "own:0040148.jpg",  # Xavier Watts, Falcons #31 (his own photo)
    "xrandywhite": "own:xrandywhite.webp",  # Randy White, Cowboys #54 (his own photo)
    "xreggiewhite": "own:xreggiewhite.jpg",  # Reggie White, Eagles #92 (his own photo)
    "0037240": "own:0037240.png",  # Jameson Williams, Lions #1 (his own photo)
    "0031933": "own:0031933.webp",  # Leonard Williams, Seahawks #99 (his own photo)
    "xcharleswoodson": "own:xcharleswoodson.jpg",  # Charles Woodson, Raiders #24 (his own photo)
    "xrodwoodson": "own:xrodwoodson.webp",  # Rod Woodson, Steelers #26 (his own photo)
    "0033831": "own:0033831.jpg",  # Andrew Wylie, Washington #71 (his own photo)
    "0039137": "own:0039137.jpg",  # Byron Young, Rams #0 (his own photo)
    "xdanmarino": "own:xdanmarino.jpg",  # Dan Marino, Dolphins #13 (his own photo)
    "xdonmaynard": "own:xdonmaynard.jpg",  # Don Maynard, Jets #13 (his own photo)
    "xanthonymuñoz": "own:xanthonymuñoz.jpg",  # Anthony Muñoz, Bengals #78 (his own photo)
    "xmerlinolsen": "own:xmerlinolsen.jpg",  # Merlin Olsen, Rams #74 (his own photo)
    "xjimotto": "own:xjimotto.jpg",  # Jim Otto, Raiders #00 (his own photo)
    "xalanpage": "own:xalanpage.jpg",  # Alan Page, Vikings #88 (his own photo)
    "xjimparker": "own:xjimparker.jpg",  # Jim Parker, Colts #77 (his own photo)
    "xleeroyselmon": "own:xleeroyselmon.jpg",  # Lee Roy Selmon, Buccaneers #63 (his own photo)
    "0039846": "own:0039846.jpg",  # Tykee Smith, Buccaneers #23 (his own photo)
    "xjanstenerud": "own:xjanstenerud.jpg",  # Jan Stenerud, Chiefs #3, kicking (a Prestige card) (his own photo)
    "xmichaelstrahan": "own:xmichaelstrahan.jpg",  # Michael Strahan, Giants #92 (his own photo)
    "0034399": "own:0034399.jpg",  # Wyatt Teller, Browns #77 (his own photo)
    "xderrickthomas": "own:xderrickthomas.jpg",  # Derrick Thomas, Chiefs #58 (his own photo)
    "xthurmanthomas": "own:xthurmanthomas.jpg",  # Thurman Thomas, Bills #34, with the ball (his own photo)
    "xgeneupshaw": "own:xgeneupshaw.jpg",  # Gene Upshaw, Raiders #63 (his own photo)
    "xbrianurlacher": "own:xbrianurlacher.jpg",  # Brian Urlacher, Bears #54 (his own photo)
    "xmikewebster": "own:xmikewebster.jpg",  # Mike Webster, Steelers #52 (his own photo)
    "xlarrywilson": "own:xlarrywilson.jpg",  # Larry Wilson, Cardinals #8 (his own photo)
    "xsteveyoung": "own:xsteveyoung.jpg",  # Steve Young, 49ers #8, throwing (his own photo)
    "0039371": "own:0039371.jpg",  # Kris Abrams-Draine, Broncos #31 (his own photo)
    "xlarryallen": "own:xlarryallen.jpg",  # Larry Allen, Cowboys #73 (his own photo)
    "xlancealworth": "own:xlancealworth.jpg",  # Lance Alworth, Chargers #19 (his own photo)
    "0039108": "own:0039108.jpg",  # Will Anderson Jr., Texans #51 (his own photo)
    "xsteveatwater": "own:xsteveatwater.jpg",  # Steve Atwater, Broncos #27 (his own photo)
    "0039172": "own:0039172.jpg",  # Jake Bates, Lions #43, kicking (his own photo)
    "0034675": "own:0034675.jpg",  # Jessie Bates, Falcons #3 (his own photo)
    "0038560": "own:0038560.jpg",  # Jordan Battle, Bengals #27 (his own photo)
    "0036418": "own:0036418.jpg",  # Zack Baun, Eagles #53 (his own photo)
    "0039840": "own:0039840.jpg",  # Austin Booker, Bears #94 (his own photo)
    "0039338": "own:0039338.jpg",  # Brock Bowers, Raiders #89 (his own photo)
    "xterrybradshaw": "own:xterrybradshaw.jpg",  # Terry Bradshaw, Steelers #12, with the ball (his own photo)
    "0039141": "own:0039141.jpg",  # Brian Branch, Lions #32 (his own photo)
    "0036409": "own:0036409.jpg",  # Jordyn Brooks, Dolphins #20 (his own photo)
    "0035676": "own:0035676.jpg",  # A.J. Brown, Patriots #1 (his own photo)
    "0036963": "own:0036963.jpg",  # Amon-Ra St. Brown, Lions #14 (his own photo)
    "0036220": "own:0036220.jpg",  # Derrick Brown, Panthers #95 (his own photo)
    "0034495": "own:0034495.jpg",  # Evan Brown, Cardinals OL (his own photo)
    "0034752": "own:0034752.jpg",  # Orlando Brown, Bengals #75 (his own photo)
    "0032071": "own:0032071.jpg",  # Trent Brown, Texans #77 (his own photo)
    "xdickbutkus": "own:xdickbutkus.jpg",  # Dick Butkus, Bears #51 (his own photo)
    "0033132": "own:0033132.jpg",  # Kevin Byard, Patriots #31 (his own photo)
    "0039018": "own:0039018.jpg",  # Jack Campbell, Lions #46 (his own photo)
    "0036974": "own:0036974.jpg",  # Tyson Campbell, Browns #7 (his own photo)
    "0032378": "own:0032378.jpg",  # DeForest Buckner, 49ers #99 (his own photo)
    "0039838": "own:0039838.jpg",  # Calen Bullock, Texans #2 (his own photo)
    "xcriscarter": "CC_Pro_Bowl.JPG",  # Cris Carter, 1999
    "0035272": "Andrew_Van_Ginkel_Dolphins-Falcons_OCT2021.png",  # Andrew Van Ginkel, 2021
    "0036994": "Ernest_Jones_South_Carolina.jpg",  # Ernest Jones, 2019
    "0037192": "George_Karlaftis.jpg",  # George Karlaftis, 2022
    "0037244": "Devin_Lloyd_and_Logan_Thomas_2022_2.jpg",  # Devin Lloyd, 2022
    "0033873": "Patrick_Mahomes_on_the_run_(51616124184).jpg",  # Patrick Mahomes, 2021
    "0034429": "Jordan_Mailata.jpg",  # Jordan Mailata, 2020
    "xbrucematthews": "Bruce_Matthews_cropped.jpg",  # Bruce Matthews, 1984
    "0039860": "Kool-Aid_McKinstry_2021.jpg",  # Kool-Aid McKinstry, 2021
    "xwarrenmoon": "Warren_Moon_and_Mike_Rozier_1987.jpg",  # Warren Moon, 1987
    "xlennymoore": "1956_topps_lenny_moore.jpg",  # Lenny Moore, 1956
    "0038552": "Riley_Moss_Broncos.png",  # Riley Moss, 2025
    "0035687": "Bobby_Okereke_(7370935)_(cropped).jpg",  # Bobby Okereke, 2022
    "xwalterpayton": "1986_Jeno's_Pizza_-_12_-_Walter_Payton_(Walter_Payton_crop).jpg",  # Walter Payton, 1984
    "0035261": "Tony_Pollard_(cropped).jpg",  # Tony Pollard, 2019
    "xdarrellerevis": "Darrelle_Revis_2014.jpg",  # Darrelle Revis, 2007
    "xjohnriggins": "JohnRiggins1983TrainingCamp.jpg",  # John Riggins, 2008
    "0036914": "Gregory_Rousseau_(51528386792)_(cropped).jpg",  # Greg Rousseau, 2021
    "0026498": "2025_Rams_vs_Titans_Matthew_Stafford_(cropped).png",  # Matthew Stafford, 2025
    "xlawrencetaylor": "own:xlawrencetaylor.jpg",  # Lawrence Taylor, Giants #56 (his own photo)
    "xadamvinatieri": "Rigoberto_Sanchez,_Adam_Vinatieri_(44679700592)_(cropped).jpg",  # Adam Vinatieri, 2018
    "xpaulwarfield": "Paul_Warfield_1971MIA.png",  # Paul Warfield, 1971
    "0037840": "NFL_Playoff_Wildcard_Game_-_Kyren_Williams_Running_Back_Rams_(54266524948).jpg",  # Kyren Williams, 2025
    "xkellenwinslow": "Kellen_Winslow_circa_1986.jpg",  # Kellen Winslow, 1987
    "0036986": "Nahshon_Wright.jpg",  # Nahshon Wright, 2025
    "xjackyoungblood": "JackYoungbloodLA.png",  # Jack Youngblood, 1980
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
    "xpeytonmanning": (0.53, 0.02, 0.72),  # Peyton Manning
    "xgalesayers": (0.5, 0.08, 0.7),  # Gale Sayers
    "xbrettfavre": (0.55, 0.12, 0.88),  # Brett Favre
    "0034857": (0.5, 0.02, 0.98),  # Josh Allen
    "0037841": (0.5, 0, 0.55),  # Quentin Lake
    "0030561": (0.6, 0.08, 0.75),  # Lane Johnson
    "0037191": (0.72, 0.06, 0.55),  # Trent McDuffie
    "0035642": (0.15, 0.12, 0.55),  # Josh Hines-Allen
    "0039337": (0.37, 0.1, 0.9),  # Malik Nabers
    "0038542": (0.5, 0, 1),  # Bijan Robinson
    "0033106": (0.5, 0, 1),  # Jared Goff
    "0036442": (0.5, 0.02, 0.98),  # Joe Burrow
    "0039918": (0.25, 0.08, 0.92),  # Caleb Williams
    "0023459": (0.6, 0.03, 0.6),  # Aaron Rodgers
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
    "xkenhouston": (0.5, 0, 1),  # Ken Houston
    "xmikehaynes": (0.5, 0.02, 1),  # Mike Haynes
    "xlougroza": (0.5, 0, 1),  # Lou Groza
    "xforrestgregg": (0.5, 0, 1),  # Forrest Gregg
    "xmikeditka": (0.47, 0.07, 0.62),  # Mike Ditka
    "xlarrycsonka": (0.5, 0, 1),  # Larry Csonka
    "xearlcampbell": (0.5, 0.04, 0.96),  # Earl Campbell
    "xbuckbuchanan": (0.5, 0, 1),  # Buck Buchanan
    "xwilliebrown": (0.5, 0, 1),  # Willie Brown
    "xtimbrown": (0.5, 0, 1),  # Tim Brown
    "xderrickbrooks": (0.48, 0.03, 0.97),  # Derrick Brooks
    "xmelblount": (0.52, 0.03, 0.96),  # Mel Blount
    "xraymondberry": (0.4, 0, 1),  # Raymond Berry
    "xbobbybell": (0.5, 0, 0.74),  # Bobby Bell
    "xchuckbednarik": (0.5, 0.08, 0.92),  # Chuck Bednarik
    "xmichaelirvin": (0.48, 0, 1),  # Michael Irvin
    "xherbadderley": (0.5, 0, 1),  # Herb Adderley
    "xtroyaikman": (0.4, 0.02, 0.98),  # Troy Aikman
    "xmortenandersen": (0.5, 0, 1),  # Morten Andersen
    "xbojackson": (0.485, 0, 1),  # Bo Jackson
    "xdeaconjones": (0.51, 0.42, 0.58),  # Deacon Jones
    "xsonnyjurgensen": (0.37, 0.04, 0.96),  # Sonny Jurgensen
    "xdicknighttrain": (0.545, 0, 1),  # Dick "Night Train" Lane
    "xstevelargent": (0.5, 0.03, 0.75),  # Steve Largent
    "xjohnmackey": (0.5, 0.1, 0.87),  # John Mackey
    "xemlentunnell": (0.54, 0.41, 0.59),  # Emlen Tunnell
    "0031364": (0.5, 0.0, 1.0),  # Jadeveon Clowney
    "0039491": (0.525, 0.001, 0.978),  # Jalen Coker
    "0036554": (0.525, 0.064, 0.936),  # Nico Collins
    "0037248": (0.595, 0.396, 0.604),  # James Cook
    "0035699": (0.5, 0.0, 1.0),  # Jamel Dean
    "0039841": (0.44, 0.163, 0.837),  # Cooper DeJean
    "xjohnelway": (0.525, 0.002, 0.998),  # John Elway
    "0032726": (0.6, 0.0, 0.915),  # Ka'imi Fairbairn
    "xmarshallfaulk": (0.5, 0.3, 0.7),  # Marshall Faulk
    "0039064": (0.49, 0.0, 1.0),  # Zay Flowers
    "xdanfouts": (0.535, 0.0, 1.0),  # Dan Fouts
    "xtonygonzalez": (0.53, 0.0, 1.0),  # Tony Gonzalez
    "xdarrellgreen": (0.53, 0.0, 1.0),  # Darrell Green
    "xrobgronkowski": (0.575, 0.085, 0.915),  # Rob Gronkowski
    "0038038": (0.5, 0.044, 0.863),  # Kyle Hamilton
    "xjohnhannah": (0.5, 0.0, 1.0),  # John Hannah
    "xfrancoharris": (0.525, 0.012, 0.946),  # Franco Harris
    "0032764": (0.535, 0.0, 1.0),  # Derrick Henry
    "0036564": (0.465, 0.0, 1.0),  # Talanoa Hufanga
    "xsamhuff": (0.525, 0.0, 1.0),  # Sam Huff
    "0031565": (0.51, 0.012, 0.988),  # Danielle Hunter
    "xwalterjones": (0.51, 0.025, 0.975),  # Walter Jones
    "xjimkelly": (0.5, 0.004, 0.996),  # Jim Kelly
    "xpaulkrause": (0.58, 0.47, 0.53),  # Paul Krause
    "xwillielanier": (0.5, 0.021, 0.967),  # Willie Lanier
    "0039065": (0.475, 0.094, 0.863),  # Sam LaPorta
    "0039343": (0.4, 0.023, 0.884),  # Kamari Lassiter
    "0037838": (0.54, 0.137, 0.863),  # Isaiah Likely
    "xboblilly": (0.4, 0.0, 1.0),  # Bob Lilly
    "0037238": (0.45, 0.095, 0.842),  # Drake London
    "xronnielott": (0.35, 0.021, 0.967),  # Ronnie Lott
    "0034974": (0.475, 0.012, 0.988),  # Julian Love
    "xcurtismartin": (0.5, 0.11, 0.89),  # Curtis Martin
    "0031279": (0.49, 0.0, 1.0),  # Jake Matthews
    "0039851": (0.43, 0.0, 1.0),  # Drake Maye
    "0037744": (0.525, 0.0, 0.988),  # Trey McBride
    "0033280": (0.54, 0.067, 0.933),  # Christian McCaffrey
    "0036388": (0.515, 0.0, 1.0),  # Xavier McKinney
    "0035358": (0.465, 0.022, 0.936),  # Chase McLaughlin
    "0036624": (0.55, 0.012, 0.988),  # Alim McNeill
    "0039888": (0.49, 0.012, 0.988),  # Quinyon Mitchell
    "0035236": (0.44, 0.074, 0.853),  # Byron Murphy
    "0039309": (0.505, 0.012, 0.988),  # Byron Murphy II
    "0039075": (0.575, 0.0, 1.0),  # Puka Nacua
    "xraynitschke": (0.55, 0.025, 0.832),  # Ray Nitschke
    "0034158": (0.5, 0.021, 0.957),  # Brian O'Neill
    "0037239": (0.585, 0.0, 1.0),  # Chris Olave
    "0035230": (0.52, 0.0, 1.0),  # Ed Oliver
    "xterrellowens": (0.55, 0.088, 0.912),  # Terrell Owens
    "0037834": (0.475, 0.0, 1.0),  # Brock Purdy
    "xjohnrandle": (0.465, 0.12, 0.88),  # John Randle
    "0039404": (0.5, 0.0, 1.0),  # Will Reichard
    "xjerryrice": (0.43, 0.012, 0.988),  # Jerry Rice
    "xjuniorseau": (0.55, 0.012, 0.988),  # Junior Seau
    "0036500": (0.475, 0.021, 0.957),  # Jamien Sherwood
    "0031898": (0.5, 0.085, 0.915),  # Alex Singleton
    "0038543": (0.39, 0.077, 0.78),  # Jaxon Smith-Njigba
    "0032965": (0.475, 0.0, 1.0),  # Ronnie Stanley
    "0034668": (0.61, 0.064, 0.936),  # Aaron Stinnie
    "0039163": (0.42, 0.428, 0.572),  # C.J. Stroud
    "0041528": (0.5, 0.0, 0.936),  # Michael Taaffe
    "xfrantarkenton": (0.55, 0.021, 0.957),  # Fran Tarkenton
    "0036223": (0.5, 0.0, 1.0),  # Jonathan Taylor
    "0039852": (0.485, 0.033, 0.967),  # Jared Verse
    "xkurtwarner": (0.315, 0.0, 1.0),  # Kurt Warner
    "0037228": (0.51, 0.043, 0.957),  # Jaylen Warren
    "0040128": (0.475, 0.0, 0.936),  # Tyler Warren
    "0038124": (0.515, 0.0, 1.0),  # Christian Watson
    "xjjwatt": (0.5, 0.0, 1.0),  # J.J. Watt
    "0040148": (0.6, 0.0, 1.0),  # Xavier Watts
    "xrandywhite": (0.49, 0.0, 1.0),  # Randy White
    "xreggiewhite": (0.45, 0.053, 0.915),  # Reggie White
    "0037240": (0.49, 0.0, 1.0),  # Jameson Williams
    "0031933": (0.56, 0.002, 0.936),  # Leonard Williams
    "xcharleswoodson": (0.5, 0.0, 0.936),  # Charles Woodson
    "xrodwoodson": (0.55, 0.449, 0.551),  # Rod Woodson
    "0033831": (0.475, 0.043, 0.957),  # Andrew Wylie
    "0039137": (0.5, 0.0, 1.0),  # Byron Young
    "xdanmarino": (0.555, 0.012, 0.988),  # Dan Marino
    "xdonmaynard": (0.575, 0.166, 0.79),  # Don Maynard
    "xanthonymuñoz": (0.5, 0.004, 0.996),  # Anthony Muñoz
    "xmerlinolsen": (0.48, 0.144, 0.853),  # Merlin Olsen
    "xjimotto": (0.475, 0.022, 0.978),  # Jim Otto
    "xalanpage": (0.545, 0.057, 0.943),  # Alan Page
    "xjimparker": (0.455, 0.0, 0.988),  # Jim Parker
    "xleeroyselmon": (0.5, 0.0, 1.0),  # Lee Roy Selmon
    "0039846": (0.51, 0.0, 1.0),  # Tykee Smith
    "xjanstenerud": (0.475, 0.056, 0.794),  # Jan Stenerud
    "xmichaelstrahan": (0.53, 0.004, 0.996),  # Michael Strahan
    "0034399": (0.455, 0.012, 0.988),  # Wyatt Teller
    "xderrickthomas": (0.58, 0.194, 0.806),  # Derrick Thomas
    "xthurmanthomas": (0.44, 0.406, 0.594),  # Thurman Thomas
    "xgeneupshaw": (0.375, 0.012, 0.988),  # Gene Upshaw
    "xbrianurlacher": (0.49, 0.0, 1.0),  # Brian Urlacher
    "xmikewebster": (0.46, 0.0, 0.978),  # Mike Webster
    "xlarrywilson": (0.5, 0.258, 0.742),  # Larry Wilson
    "xsteveyoung": (0.52, 0.0, 1.0),  # Steve Young
    "0039371": (0.345, 0.0, 1.0),  # Kris Abrams-Draine
    "xlarryallen": (0.59, 0.0, 1.0),  # Larry Allen
    "xlancealworth": (0.45, 0.021, 0.957),  # Lance Alworth
    "0039108": (0.52, 0.0, 1.0),  # Will Anderson Jr.
    "xsteveatwater": (0.515, 0.0, 1.0),  # Steve Atwater
    "0039172": (0.525, 0.205, 0.795),  # Jake Bates
    "0034675": (0.41, 0.012, 0.988),  # Jessie Bates
    "0038560": (0.475, 0.0, 1.0),  # Jordan Battle
    "0036418": (0.485, 0.023, 0.977),  # Zack Baun
    "0039840": (0.525, 0.0, 1.0),  # Austin Booker
    "0039338": (0.51, 0.0, 1.0),  # Brock Bowers
    "xterrybradshaw": (0.455, 0.021, 0.967),  # Terry Bradshaw
    "0039141": (0.525, 0.311, 0.689),  # Brian Branch
    "0036409": (0.46, 0.0, 1.0),  # Jordyn Brooks
    "0035676": (0.5, 0.096, 0.79),  # A.J. Brown
    "0036963": (0.545, 0.099, 0.901),  # Amon-Ra St. Brown
    "0036220": (0.53, 0.043, 0.957),  # Derrick Brown
    "0034495": (0.55, 0.343, 0.657),  # Evan Brown
    "0034752": (0.51, 0.025, 0.975),  # Orlando Brown
    "0032071": (0.5, 0.126, 0.746),  # Trent Brown
    "xdickbutkus": (0.46, 0.023, 0.915),  # Dick Butkus
    "0033132": (0.49, 0.074, 0.863),  # Kevin Byard
    "0039018": (0.505, 0.0, 1.0),  # Jack Campbell
    "0036974": (0.405, 0.023, 0.892),  # Tyson Campbell
    "0032378": (0.515, 0.078, 0.922),  # DeForest Buckner
    "0039838": (0.58, 0.043, 0.957),  # Calen Bullock
    "0037244": (0.3, 0, 1),  # Devin Lloyd
    "0033873": (0.37, 0.18, 0.8),  # Patrick Mahomes
    "xwarrenmoon": (0.25, 0, 1),  # Warren Moon
    "xdarrellerevis": (0.5, 0, 1),  # Darrelle Revis
    "xlawrencetaylor": (0.5, 0, 1),  # Lawrence Taylor
    "0035248": (0.445, 0, 1),  # Zach Allen
    "0037840": (0.36, 0.36, 0.4),  # Kyren Williams
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


def flatten(src, out, pad=False):
    """An owner's photo on white (a cut-out he found keeps its transparency as white, which the cut-out clears again),
    and, padded (PAD), with white above it until it is as tall as the window's shape, so a wide figure fits whole."""
    from PIL import Image, ImageOps
    img = ImageOps.exif_transpose(Image.open(src)).convert('RGBA')
    flat = Image.new('RGBA', img.size, 'white')
    flat.alpha_composite(img)
    iw, ih = img.size
    if pad and iw * H > ih * W:
        tall = Image.new('RGBA', (iw, round(iw * H / W)), 'white')
        tall.paste(flat, (0, tall.height - ih))
        flat = tall
    flat.convert('RGB').save(out)


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
        elif key in PICK and PICK[key].startswith('own:'):
            # (a photo the owner collected himself, kept in tools/dynasty/photos: no author or licence to credit)
            f = os.path.join(OWN, PICK[key][4:])
            if not os.path.exists(f):
                print('no such photo:', key, f, file=sys.stderr)
                continue
            raw = os.path.join(CACHE, f'raw-{slug(key)}-own.png')
            tag = hashlib.sha1(json.dumps([PICK[key], os.path.getsize(f), key in PAD, CROP.get(key), W, H, S]).encode()).hexdigest()[:10]
            src = os.path.join(CACHE, f'crop-{slug(key)}-{tag}.png')
            if not os.path.exists(src) and not done:
                flatten(f, raw, key in PAD)
                crop(raw, src, CROP.get(key))
            row = [stem, PICK[key], '', '', '', YEAR.get(key, 0)]
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
