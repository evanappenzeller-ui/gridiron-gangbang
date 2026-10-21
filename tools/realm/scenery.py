# The Realm's scenery (img/realm/scenery/, laid round the lot by js/views/realm-3d.js), in two shapes from one set of
# pictures: the modular coastal set (Oct 2026: Modular_Scenery_Part_1_Terrain_Castle_Village.zip and
# Part_2_Harbor_Nature.zip, unpacked together into GOT_Modular_Scenery): fifteen pictures (the castle, the village, the
# harbour, trees and wheat), stood on a landscape where a layout puts them.
#   wide (landscape screens): its blank landscape and its scene_layout.json, as they came;
#   tall (portrait screens, the owner's ask): the owner's portrait landscape (a coast down the left, the meadow, forest
#   round it, hills and lakes beyond) with the placements in tools/realm/scenery-tall.json (laid out after his finished
#   portrait picture: the village top left, the castle top right, the harbour on the shore, a farm bottom right).
#   python3 tools/realm/scenery.py <the folder the zips were unpacked into: GOT_Modular_Scenery> <the portrait blank landscape .png>
# Out: ground.webp and ground-tall.webp; one picture an asset (<asset id>.webp: its empty edges trimmed off, then made
# SHARP times the size it's drawn at its largest in either layout, never larger than it came); layout.json and
# layout-tall.json: the placements, the assets (each given its picture's file, size and crop: the trimmed box, in the
# original's px, so an instance's rect still places the whole original exactly), the build zone and the lot (LOT: where
# it lies, its middle and its diamond's height, px; as big as fits in the build zone). Edit the placements in the
# layouts (the tall one here, then run this again).
import sys, os, json
import numpy as np
from PIL import Image

SRC, TALL_BG = sys.argv[1], sys.argv[2]
OUT = 'img/realm/scenery'
SHARP = 2.5
LOT = {'cx': 1050, 'cy': 610, 'h': 430}  # (the wide layout's; the tall one has its own)
os.makedirs(OUT, exist_ok=True)
wide = json.load(open(os.path.join(SRC, 'scene_layout.json')))
wide['lot'] = LOT
tall = json.load(open(os.path.join(os.path.dirname(__file__), 'scenery-tall.json')))
assets = wide['assets']
most = {}
for lay in (wide, tall):
    for it in lay['instances']:
        most[it['asset_id']] = max(most.get(it['asset_id'], 0), it['rect']['width'], it['rect']['height'])
total = 0
for aid, a in assets.items():
    im = Image.open(os.path.join(SRC, a['file']))
    if aid == wide['scene']['background_asset_id']:
        im.convert('RGB').save(os.path.join(OUT, 'ground.webp'), quality=86, method=6)
        a['pic'] = {'file': 'ground.webp', 'w': im.width, 'h': im.height}
        continue
    im = im.convert('RGBA')
    ys, xs = np.nonzero(np.asarray(im)[:, :, 3] > 8)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    k = min(1, SHARP * most.get(aid, 0) / max(a['width'], a['height']))
    w, h = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
    im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS).save(os.path.join(OUT, aid + '.webp'), quality=88, method=6, exact=False)
    a['pic'] = {'file': aid + '.webp', 'w': w, 'h': h, 'crop': [x0, y0, x1, y1]}
    total += w * h
    print(aid, 'crop', (x0, y0, x1, y1), '->', (w, h), os.path.getsize(os.path.join(OUT, aid + '.webp')), 'bytes')
im = Image.open(TALL_BG).convert('RGB')
im.save(os.path.join(OUT, 'ground-tall.webp'), quality=86, method=6)
tall['assets'] = {**{k: v for k, v in assets.items() if k != wide['scene']['background_asset_id']},
                  tall['scene']['background_asset_id']: {'file': os.path.basename(TALL_BG), 'category': 'terrain', 'width': im.width, 'height': im.height, 'transparent': False,
                                                          'pic': {'file': 'ground-tall.webp', 'w': im.width, 'h': im.height}}}
json.dump(wide, open(os.path.join(OUT, 'layout.json'), 'w'), indent=1)
json.dump(tall, open(os.path.join(OUT, 'layout-tall.json'), 'w'), indent=1)
print('pictures', round(total / 1e6, 2), 'M px; grounds', os.path.getsize(os.path.join(OUT, 'ground.webp')), os.path.getsize(os.path.join(OUT, 'ground-tall.webp')), 'bytes')
