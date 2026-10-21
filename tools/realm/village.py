# The village round each land's lot (img/realm/scenery/<land>/v-*.webp, stood up round the lot by
# js/views/realm-3d.js sceneryPictures(), drawn as they are: the camera never turns): the owner's Kingdom Base Builder
# Kit (Oct 2026), its building pictures, one set to a land, where tools/realm/village.json puts them (edit there, then
# run this again). Run it after sceneries.py (which lays each layout down bare).
#   python3 tools/realm/village.py <the kit's folder: Kingdom_Base_Builder_Kit>
# Each picture's trimmed to what's drawn and kept at up to 3x the size it's drawn on the landscape. Its place in the
# layout keeps the kit's anchor (the middle of its foot, 95% down the whole picture; the contact shadow under it): the
# asset is the whole picture down to there, its crop what's drawn (below it too).
import sys, os, json, math
from PIL import Image

KIT = sys.argv[1]
HERE = os.path.dirname(__file__)
OUT = 'img/realm/scenery'
SIN_P = math.sin(.9)  # (the camera's pitch, views/realm-3d.js PITCH)
UP = 3                # (kept at up to this many px to one drawn on the landscape)

V = json.load(open(os.path.join(HERE, 'village.json')))
cat = json.load(open(os.path.join(KIT, 'data', 'catalog.json')))
bad = 0
for land, cfg in V['lands'].items():
    th = next(t for t in cat['themes'] if t['id'] == cfg['kit'])
    have = {a['id']: a for a in th['assets'] if a['id'] not in th.get('unplacedAssets', [])}
    spots = {**V['spots'], **cfg.get('spots', {})}
    path = os.path.join(OUT, f'layout-{land}.json')
    lay = json.load(open(path))
    bg = lay['scene']['background_asset_id']
    lay['assets'] = {k: a for k, a in lay['assets'].items() if k == bg or not k.startswith(land + ':v-')}
    lay['instances'] = [it for it in lay['instances'] if not it['asset_id'].startswith(land + ':v-')]
    for f in os.listdir(os.path.join(OUT, land)):
        if f.startswith('v-'): os.remove(os.path.join(OUT, land, f))
    zone = lay['build_zone_polygon']
    L = lay['lot']; hh = L['h'] / 2 * 1.08; hw = hh / SIN_P
    in_zone = lambda x, y: abs(x - L['cx']) / hw + abs(y - L['cy']) / hh < 1
    drawn = {}
    for name, spot in spots.items():
        kind = name.split('_2')[0] if name.endswith('_2') else name
        if spot is None or kind not in have: continue
        x, y, w = spot
        a = have[kind]
        im = Image.open(os.path.join(KIT, a['image'])).convert('RGBA')
        W, H = im.size
        box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        ax, ay = a['anchor']
        aid = f'{land}:v-{kind}'
        if aid not in lay['assets']:
            pic = im.crop(box)
            k = min(1, UP * w / W)
            if k < 1: pic = pic.resize((max(1, round(pic.width * k)), max(1, round(pic.height * k))), Image.LANCZOS)
            pic.save(os.path.join(OUT, land, f'v-{kind}.webp'), quality=88, method=6)
            lay['assets'][aid] = {'width': W, 'height': round(H * ay, 2), 'kit': a['image'],
                                  'pic': {'file': f'{land}/v-{kind}.webp', 'w': pic.width, 'h': pic.height, 'crop': list(box)}}
        h = w * H * ay / W
        lay['instances'].append({'id': f'v-{name}', 'asset_id': aid, 'rect': {'x': round(x - w * ax, 1), 'y': round(y - h, 1), 'width': w, 'height': round(h, 1)}, 'draw_order': y})
        # (its foot: the kit's diamond, 70% of the picture's width across, 28% deep)
        fw, fd = w * .35, w * .14
        hit = [p for p in [(x - fw, y), (x + fw, y), (x, y - fd), (x, y + fd)] if in_zone(*p)]
        if hit: bad += 1; print(f'{land} {name}: its foot is in the build zone')
    lay['instances'].sort(key=lambda it: it['draw_order'])
    json.dump(lay, open(path, 'w'), indent=1)
    print(land, len([i for i in lay['instances'] if i['id'].startswith('v-')]), 'placed')
sys.exit(1 if bad else 0)
