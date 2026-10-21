# The Realm's lands (img/realm/scenery/, laid round the lot by js/views/realm-3d.js; unlocked by the Keep's level,
# core/realm.js SCENERIES): the coast, the Enchanted Forest, the Frozen Tundra, the Ocean Sanctuary, the Amber Desert
# and the Infernal Wastes (Oct 2026: Blank_Sceneries_All_Six.zip, unpacked into one folder). Each is a blank portrait
# landscape, tall enough round its open ground that the camera can zoom right out without looking past its edges; the
# lot lies where tools/realm/sceneries.json puts it (edit there, then run this again).
#   python3 tools/realm/sceneries.py <the folder they were unpacked into>
# Out: <land>/ground.webp, layout-<land>.json (the coast's layout shape: the landscape, nothing stood on it, the build
# zone just round the lot, the lot).
import sys, os, json
import numpy as np
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(__file__)
OUT = 'img/realm/scenery'
SIN_P = np.sin(.9)  # (the camera's pitch, views/realm-3d.js PITCH: a lot diamond's height to its width)

T = json.load(open(os.path.join(HERE, 'sceneries.json')))
for key, t in T.items():
    if key == '_': continue
    os.makedirs(os.path.join(OUT, key), exist_ok=True)
    ground = Image.open(os.path.join(SRC, t['file'])).convert('RGB')
    ground.save(os.path.join(OUT, key, 'ground.webp'), quality=86, method=6)
    bg = key + ':ground'
    assets = {bg: {'width': ground.width, 'height': ground.height, 'pic': {'file': f'{key}/ground.webp', 'w': ground.width, 'h': ground.height}}}
    L = t['lot']; hh = L['h'] / 2 * 1.08; hw = hh / SIN_P
    zone = [[round(L['cx'] - hw), L['cy']], [L['cx'], round(L['cy'] - hh)], [round(L['cx'] + hw), L['cy']], [L['cx'], round(L['cy'] + hh)]]
    lay = {'schema_version': 1, 'scene': {'width': ground.width, 'height': ground.height, 'origin': 'top-left', 'units': 'reference pixels', 'background_asset_id': bg},
           'placement_convention': 'x,y = bottom-center of the picture; rect for exact drawing', 'build_zone_polygon': zone, 'lot': L, 'assets': assets, 'instances': []}
    json.dump(lay, open(os.path.join(OUT, f'layout-{key}.json'), 'w'), indent=1)
    print(key, ground.size, os.path.getsize(os.path.join(OUT, key, 'ground.webp')), 'bytes')
