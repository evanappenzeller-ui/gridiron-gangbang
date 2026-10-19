# Kick It's sprites (img/kick/*.webp) from the field-goal asset pack's PNGs: trims stray bits at the edges, crops,
# scales, makes the holder with empty gloves (the ball taken out), and prints each picture's anchor and scale for
# SPRITES in js/views/kick.js.
#   python3 tools/kick/sprites.py <the pack's folder> img/kick
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
def load(n):
    im = Image.open(f'{src}/{n}').convert('RGBA')
    a = im.getchannel('A').point(lambda v: 0 if v <= 8 else min(255, int(v * 255 / 253)))
    im.putalpha(a)
    return im
def crop(im):
    box = im.getchannel('A').getbbox()
    return im.crop(box), box
def save(im, name, k):
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(f'{out}/{name}.webp', 'WEBP', quality=90, method=6)
    return im.size
res = {}
# the kicker, winding up (B: a stray bit of ball at its left edge goes) and following through (A)
kb = load('kicker_pose_B.png'); p = kb.load()
for y in range(720, kb.height):
    for x in range(0, 32): p[x, y] = (0, 0, 0, 0)
ka = load('kicker_pose_A.png')
K = .62
for name, im, anchor in (('kicker-b', kb, (110, 975)), ('kicker-a', ka, (95, 835))):
    c, box = crop(im)
    size = save(c, name, K)
    res[name] = {'w': size[0], 'h': size[1], 'ax': round((anchor[0] - box[0]) * K, 1), 'ay': round((anchor[1] - box[1]) * K, 1), 'pxPerYd': round(447 * K, 1)}
# the holder with the ball, and without it (after the kick: the gloves stay, the ball's gone)
ha = load('holder_pose_A.png')
he = ha.copy(); p = he.load()
cx, cy, rx, ry = 682, 508, 60, 94
for y in range(cy - ry, min(he.height, cy + ry + 1)):
    for x in range(cx - rx, min(he.width, cx + rx + 1)):
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1: continue
        r, g, b, a = p[x, y]
        glove = b > r + 12 and b > g + 8 and max(r, g, b) < 170
        if not glove: p[x, y] = (0, 0, 0, 0)
H = .6
c, box = crop(ha)
size = save(c, 'holder', H)
res['holder'] = {'w': size[0], 'h': size[1], 'ax': round((682 - box[0]) * H, 1), 'ay': round((598 - box[1]) * H, 1), 'pxPerYd': round(480 * H, 1)}
ce = he.crop(box)
save(ce, 'holder-empty', H)
# the ball
fb = load('football.png'); c, box = crop(fb)
size = save(c, 'football', 200 / c.width)
res['football'] = {'w': size[0], 'h': size[1]}
for k, v in res.items(): print(k, v)
