# The Realm's unlockable sceneries (img/realm/scenery/<theme>/, laid round the lot by js/views/realm-3d.js; unlocked by
# the Keep's level, core/realm.js SCENERIES): Frozen Tundra, Ocean Sanctuary and Infernal Wastes (Oct 2026: a zip each,
# unpacked into one folder: <folder>/Frozen_Tundra/, ...). Each is a tall blank landscape and a sheet of eight pictures
# (castle, great hall / cottage, watchtower / forge, storehouse / dock, ship: two columns, four rows, not even cells),
# placed after its finished preview by tools/realm/scenery-themes.json (edit there, then run this again).
#   python3 tools/realm/scenery_themes.py <the folder they were unpacked into>
# Each picture is cut from its sheet (its column, then its row, split at the emptiest rows between; the bits of it big
# enough to count; a bit of a neighbour's lying below it dropped), trimmed, and made SHARP times the size it's drawn at
# (never larger than it came). Out: <theme>/ground.webp, <theme>/<picture>.webp, layout-<theme>.json (laid out like
# the coast's: assets, instances with their rects, the build zone just round the lot, the lot).
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1]
HERE = os.path.dirname(__file__)
OUT = 'img/realm/scenery'
SHARP = 2.5
NAMES = [['castle', 'hall'], ['cottage', 'watchtower'], ['forge', 'storehouse'], ['dock', 'ship']]
SIN_P = np.sin(.9)  # (the camera's pitch, views/realm-3d.js PITCH: a lot diamond's height to its width)


def cut(sheet):
    """The sheet's eight pictures, {name: RGBA array}."""
    a = np.asarray(Image.open(sheet).convert('RGBA')).copy()
    m = a[:, :, 3] > 8
    H, W = m.shape
    col = m.sum(0)
    mid = int(np.argmin(np.convolve(col, np.ones(15), 'same')[W // 3: 2 * W // 3]) + W // 3)
    out = {}
    for c, (x0, x1) in enumerate([(0, mid), (mid, W)]):
        rows = np.convolve(m[:, x0:x1].sum(1), np.ones(7), 'same')
        cuts = [0]
        for e in (.345 * H, .57 * H, .77 * H):
            lo, hi = int(e - 90), int(e + 90)
            cuts.append(lo + int(np.argmin(rows[lo:hi])))
        cuts.append(H)
        for r in range(4):
            y0, y1 = cuts[r], cuts[r + 1]
            cell = m[y0:y1, x0:x1]
            lab, n = ndimage.label(ndimage.binary_dilation(cell, iterations=2))
            sz = ndimage.sum(cell, lab, range(1, n + 1))
            objs = ndimage.find_objects(lab)
            mb = objs[int(np.argmax(sz))][0].stop
            # (a piece of the main body's, or above it, a flag; not one hanging below it: a neighbour's)
            keep = [i + 1 for i in range(n) if sz[i] >= .02 * sz.max() and objs[i][0].start < mb - 4]
            k = np.isin(lab, keep) & cell
            ys, xs = np.nonzero(k)
            piece = a[y0:y1, x0:x1].copy()
            piece[~k, 3] = 0
            piece = piece[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            # (a bit lying below the main body, apart from it once the faintest edges are let go: dropped)
            al = piece[:, :, 3] > 40
            lab2, n2 = ndimage.label(al)
            ob2, s2 = ndimage.find_objects(lab2), ndimage.sum(al, lab2, range(1, n2 + 1))
            mbot = ob2[int(np.argmax(s2))][0].stop
            for i in range(n2):
                if ob2[i][0].start >= mbot - 12: piece[lab2 == i + 1, 3] = 0
            ys, xs = np.nonzero(piece[:, :, 3] > 40)
            piece = piece[:ys.max() + 1, xs.min():xs.max() + 1]
            out[NAMES[r][c]] = piece
    return out


T = json.load(open(os.path.join(HERE, 'scenery-themes.json')))
for key, t in T.items():
    if key == '_': continue
    folder = os.path.join(SRC, t['folder'])
    os.makedirs(os.path.join(OUT, key), exist_ok=True)
    pics = cut(os.path.join(folder, 'transparent_sprite_sheet.png'))
    ground = Image.open(os.path.join(folder, 'blank_terrain_original.png')).convert('RGB')
    ground.save(os.path.join(OUT, key, 'ground.webp'), quality=86, method=6)
    bg = key + ':ground'
    assets = {bg: {'width': ground.width, 'height': ground.height, 'pic': {'file': f'{key}/ground.webp', 'w': ground.width, 'h': ground.height}}}
    most = {}
    for n, x, y, w in t['place']: most[n] = max(most.get(n, 0), w)
    for n, a in pics.items():
        if n not in most: continue
        h, w = a.shape[:2]
        k = min(1, SHARP * most[n] / w)
        pw, ph = max(1, round(w * k)), max(1, round(h * k))
        Image.fromarray(a).resize((pw, ph), Image.LANCZOS).save(os.path.join(OUT, key, n + '.webp'), quality=88, method=6, exact=False)
        assets[f'{key}:{n}'] = {'width': w, 'height': h, 'pic': {'file': f'{key}/{n}.webp', 'w': pw, 'h': ph, 'crop': [0, 0, w, h]}}
    inst = []
    for i, (n, x, y, w) in enumerate(sorted(t['place'], key=lambda p: p[2])):
        a = assets[f'{key}:{n}']; h = round(w * a['height'] / a['width'])
        inst.append({'id': f'{n}_{i}', 'asset_id': f'{key}:{n}', 'x': x, 'y': y, 'width': w, 'height': h, 'anchor': [.5, 1.0],
                     'rect': {'x': round(x - w / 2), 'y': y - h, 'width': w, 'height': h}, 'draw_order': i})
    L = t['lot']; hh = L['h'] / 2 * 1.08; hw = hh / SIN_P
    zone = [[round(L['cx'] - hw), L['cy']], [L['cx'], round(L['cy'] - hh)], [round(L['cx'] + hw), L['cy']], [L['cx'], round(L['cy'] + hh)]]
    lay = {'schema_version': 1, 'scene': {'width': ground.width, 'height': ground.height, 'origin': 'top-left', 'units': 'reference pixels', 'background_asset_id': bg},
           'placement_convention': 'x,y = bottom-center of the picture; rect for exact drawing', 'build_zone_polygon': zone, 'lot': L, 'assets': assets, 'instances': inst}
    json.dump(lay, open(os.path.join(OUT, f'layout-{key}.json'), 'w'), indent=1)
    size = sum(os.path.getsize(os.path.join(OUT, key, f)) for f in os.listdir(os.path.join(OUT, key)))
    print(key, len(inst), 'placed;', len(assets) - 1, 'pictures;', size, 'bytes')
