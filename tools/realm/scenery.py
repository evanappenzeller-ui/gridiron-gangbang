# The Realm's scenery (img/realm/scenery/, laid round the lot by js/views/realm-3d.js): the modular coastal set (Oct
# 2026: Modular_Scenery_Part_1_Terrain_Castle_Village.zip and Part_2_Harbor_Nature.zip, unpacked together into
# GOT_Modular_Scenery): a blank landscape (the sea, the shore and the meadow, distant hills and lakes) and fifteen
# pictures stood on it where scene_layout.json puts them (the castle, the village, the harbour, trees and wheat).
#   python3 tools/realm/scenery.py <the folder the zips were unpacked into: GOT_Modular_Scenery>
# Out: ground.webp (the landscape, its own size), one picture an asset (<asset id>.webp: its empty edges trimmed off,
# then made SHARP times the size it's drawn at its largest in the scene, never larger than it came), and layout.json:
# the set's scene_layout.json as it came, each asset given its picture's file, size and crop (the trimmed box, in the
# original's px, so an instance's rect still places the whole original exactly). Edit the placements in layout.json
# (the instances; the build zone is where the lot goes, views/realm-3d.js SCENE).
import sys, os, json
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = 'img/realm/scenery'
SHARP = 2.5
os.makedirs(OUT, exist_ok=True)
lay = json.load(open(os.path.join(SRC, 'scene_layout.json')))
bg = lay['scene']['background_asset_id']
most = {}
for it in lay['instances']:
    most[it['asset_id']] = max(most.get(it['asset_id'], 0), it['rect']['width'], it['rect']['height'])
total = 0
for aid, a in lay['assets'].items():
    im = Image.open(os.path.join(SRC, a['file']))
    if aid == bg:
        im.convert('RGB').save(os.path.join(OUT, 'ground.webp'), quality=86, method=6)
        a['pic'] = {'file': 'ground.webp', 'w': im.width, 'h': im.height}
        continue
    im = im.convert('RGBA')
    al = np.asarray(im)[:, :, 3]
    ys, xs = np.nonzero(al > 8)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    k = min(1, SHARP * most.get(aid, 0) / max(a['width'], a['height']))
    w, h = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
    pic = im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS)
    pic.save(os.path.join(OUT, aid + '.webp'), quality=88, method=6, exact=False)
    a['pic'] = {'file': aid + '.webp', 'w': w, 'h': h, 'crop': [x0, y0, x1, y1]}
    total += w * h
    print(aid, 'crop', (x0, y0, x1, y1), '->', (w, h), os.path.getsize(os.path.join(OUT, aid + '.webp')), 'bytes')
json.dump(lay, open(os.path.join(OUT, 'layout.json'), 'w'), indent=1)
print('pictures', round(total / 1e6, 2), 'M px; ground', os.path.getsize(os.path.join(OUT, 'ground.webp')), 'bytes')
