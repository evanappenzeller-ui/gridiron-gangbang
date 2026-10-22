# The Realm's army drawn from its art (img/realm/army/, js/views/realm-3d.js: the soldiers in an attack, and their
# pictures in the Army and the attack's picker): the owner's unit pictures (Oct 2026: GOT_Army_Units_No_Sapper.zip, a
# transparent picture each of the Footman, Archer, Knight, Thief and Dragon).
#   python3 tools/realm/army.py <the folder the zip was unpacked into>
# Each is trimmed to what's drawn and made TALL px tall (the Dragon WIDE px wide), and noted in army.json: its size,
# where it stands (a soldier: under the middle of him (where his weight is: a sword or a bow reaching down to his feet
# doesn't move it), the bottom of the picture; the Dragon: its middle, it flies), the way it faces (right: true when it
# looks to the right of the picture) and how big it's drawn (tall: tiles; the Dragon's wide: tiles).
import sys, os, json
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = 'img/realm/army'
TALL, WIDE = 320, 520
UNITS = {  # file, faces right, how big (tiles)
    'footman': ('Footman.png', False, {'tall': 1.05}),
    'archer': ('Archer.png', True, {'tall': 1.05}),
    'knight': ('Knight.png', False, {'tall': 1.2}),
    'thief': ('Thief.png', False, {'tall': 1.0}),
    'dragon': ('Dragon.png', True, {'wide': 3.4}),
}
os.makedirs(OUT, exist_ok=True)
meta = {}
for k, (f, right, size) in UNITS.items():
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    al = np.asarray(im)[:, :, 3] > 8
    ys, xs = np.nonzero(al)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    s = WIDE / im.width if k == 'dragon' else TALL / im.height
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    a = np.asarray(im)[:, :, 3] > 40
    if k == 'dragon':
        ax, ay = im.width / 2, im.height / 2
    else:
        ax, ay = np.nonzero(a)[1].mean(), im.height
    im.save(os.path.join(OUT, k + '.webp'), quality=88, method=6, exact=False)
    meta[k] = {'w': im.width, 'h': im.height, 'ax': round(float(ax), 1), 'ay': round(float(ay), 1), 'right': right, 'fly': k == 'dragon', **size}
    print(k, im.size, meta[k], os.path.getsize(os.path.join(OUT, k + '.webp')), 'bytes')
json.dump(meta, open(os.path.join(OUT, 'army.json'), 'w'), indent=1)
