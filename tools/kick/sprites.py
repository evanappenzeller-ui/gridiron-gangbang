# Kick It's sprites (img/kick/*.webp) from the art: the line sheet (a 4 x 4 sheet: rows 1-2 our blockers from behind,
# rows 3-4 the rush from the front), the kicker and holder from behind (one picture, the kicker at its left winding up,
# the holder kneeling with the ball at its right) and the kicker's follow-through from behind.
#   python3 tools/kick/sprites.py <line sheet.png> <kicker and holder.png> img/kick [<follow-through.png>]
# The sheet's figures overlap their neighbours' cells a little (arms up reach into the row above), so each figure is
# its connected shapes, gathered by the cell their middle falls in. Every figure is cropped, scaled to the same px a
# yard and packed into one atlas (line.webp); the kicker, the holder and the holder with empty hands (the ball taken
# out) are pictures of their own. Prints the frames and anchors for SPRITES and LINE_ART in js/views/kick.js.
# (football.webp, the ball in the air, came from the earlier field-goal asset pack.)
import sys, json
from collections import deque
import numpy as np
from PIL import Image

line_src, kh_src, out = sys.argv[1], sys.argv[2], sys.argv[3]
follow_src = sys.argv[4] if len(sys.argv) > 4 else None

def load(p):
    im = Image.open(p).convert('RGBA')
    a = np.array(im)
    al = a[:, :, 3].astype(np.int32)
    al[al <= 8] = 0                                  # the near-invisible fringe some edges carry
    al = np.minimum(255, (al * 255) // 253)          # solid where the art is (it stops at 253)
    a[:, :, 3] = al.astype(np.uint8)
    return a

def components(mask, k=2):
    """Connected shapes of a mask (looked at k x k px at a time): a list of (pixel count, ys, xs) at full size."""
    small = mask[::k, ::k]
    h, w = small.shape
    seen = np.zeros_like(small, dtype=bool)
    out = []
    for y0, x0 in zip(*np.nonzero(small)):
        if seen[y0, x0]: continue
        q = deque([(y0, x0)]); seen[y0, x0] = True; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        ys = np.array([p[0] for p in pts]) * k; xs = np.array([p[1] for p in pts]) * k
        out.append((len(pts), ys, xs))
    return out

def save(img, name, q=90):
    img.save(f'{out}/{name}.webp', 'WEBP', quality=q, method=6)

# ---- the line: 16 figures, packed into one atlas at LK of the sheet's size
sheet = load(line_src)
H, W = sheet.shape[:2]
cw, ch = W / 4, H / 4
mask = sheet[:, :, 3] > 100
cells = {}
for n, ys, xs in components(mask):
    if n < 25: continue                              # specks
    cy, cx = ys.mean(), xs.mean()
    key = (min(3, int(cy // ch)), min(3, int(cx // cw)))
    cells.setdefault(key, []).append((ys, xs))
LK = .5
frames, tiles = [], []
for r in range(4):
    for c in range(4):
        parts = cells.get((r, c), [])
        fm = np.zeros(mask.shape, dtype=bool)
        for ys, xs in parts:
            for dy in (0, 1):
                for dx in (0, 1):
                    fm[np.clip(ys + dy, 0, H - 1), np.clip(xs + dx, 0, W - 1)] = True
        # grow the shape a little so its soft edge comes along
        g = fm.copy()
        for _ in range(3):
            g[1:, :] |= g[:-1, :]; g[:-1, :] |= g[1:, :]; g[:, 1:] |= g[:, :-1]; g[:, :-1] |= g[:, 1:]
        a = sheet.copy(); a[~g, 3] = 0
        ys, xs = np.nonzero(a[:, :, 3] > 100)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = Image.fromarray(a[y0:y1, x0:x1])
        # the anchor: under the figure's middle (its weight), at the bottom of the lowest cleat (or hand on the turf)
        ax, ay = xs.mean() - x0, ys.max() - y0
        tw, th = round(crop.width * LK), round(crop.height * LK)
        tiles.append(crop.resize((tw, th), Image.LANCZOS))
        frames.append({'r': r, 'c': c, 'w': tw, 'h': th, 'ax': round(ax * LK, 1), 'ay': round(ay * LK, 1)})
# pack 4 a row
pad = 4
rowsh = [max(t.height for t in tiles[i:i + 4]) for i in range(0, 16, 4)]
AW = max(sum(t.width for t in tiles[i:i + 4]) + pad * 5 for i in range(0, 16, 4))
atlas = Image.new('RGBA', (AW, sum(rowsh) + pad * 5), (0, 0, 0, 0))
y = pad
for i in range(0, 16, 4):
    x = pad
    for j, t in enumerate(tiles[i:i + 4]):
        atlas.paste(t, (x, y)); frames[i + j].update({'x': x, 'y': y}); x += t.width + pad
    y += rowsh[i // 4] + pad
save(atlas, 'line', 88)
print('line atlas', atlas.size, 'px a yard', round(250 * LK))
print('LINE_ART frames (x, y, w, h, ax, ay):')
print(json.dumps([[f['x'], f['y'], f['w'], f['h'], f['ax'], f['ay']] for f in frames]))

# ---- the kicker and the holder
kh = load(kh_src)
H2, W2 = kh.shape[:2]
KK = .58
parts = [p for p in components(kh[:, :, 3] > 100) if p[0] >= 25]
left = np.zeros(kh.shape[:2], dtype=bool); right = np.zeros(kh.shape[:2], dtype=bool)
for n, ys, xs in parts:
    tgt = left if xs.mean() < W2 * .55 else right
    for dy in (0, 1):
        for dx in (0, 1):
            tgt[np.clip(ys + dy, 0, H2 - 1), np.clip(xs + dx, 0, W2 - 1)] = True
def figure(m, name, anchor):
    g = m.copy()
    for _ in range(3):
        g[1:, :] |= g[:-1, :]; g[:-1, :] |= g[1:, :]; g[:, 1:] |= g[:, :-1]; g[:, :-1] |= g[:, 1:]
    a = kh.copy(); a[~g, 3] = 0
    ys, xs = np.nonzero(a[:, :, 3] > 100)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return a[y0:y1, x0:x1], (anchor[0] - x0, anchor[1] - y0)
kicker, kanc = figure(left, 'kicker', (805, 828))           # the planted foot
holder, hanc = figure(right, 'holder', (1151, 818))          # the ball's tip on the turf
def out_img(a, name):
    im = Image.fromarray(a); im = im.resize((round(im.width * KK), round(im.height * KK)), Image.LANCZOS); save(im, name); return im.size
ks = out_img(kicker, 'kicker'); hs = out_img(holder, 'holder')
# the holder's hand with no ball under it: the ball's leather and laces go, the hand on top stays
e = holder.copy()
cx, cy, rx, ry = hanc[0], hanc[1] - 66, 47, 69
yy, xx = np.mgrid[0:e.shape[0], 0:e.shape[1]]
inside = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
r_, g_, b_ = e[:, :, 0].astype(int), e[:, :, 1].astype(int), e[:, :, 2].astype(int)
skin = (r_ > 170) & (g_ > 105) & (b_ > 70) & (r_ - b_ > 40) & (r_ - g_ < 90)
e[inside & ~skin, 3] = 0
out_img(e, 'holder-empty')
print('kicker', ks, 'anchor', [round(v * KK, 1) for v in kanc], 'px a yard', round(425 * KK, 1))
print('holder', hs, 'anchor', [round(v * KK, 1) for v in hanc], 'px a yard', round(430 * KK, 1))

# ---- the kicker's follow-through: the same kicker drawn bigger (its helmet ~1.57 times as wide), so scaled to the
# wind-up's px a yard; anchored at the planted foot
if follow_src:
    fo = load(follow_src)
    ys, xs = np.nonzero(fo[:, :, 3] > 100)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    low = ys.max(); band = xs[ys >= low - 20]
    fanc = ((band.min() + band.max()) / 2 - x0, low - y0)
    KF = 425 * KK / (425 * 1.57)
    im = Image.fromarray(fo[y0:y1, x0:x1]); im = im.resize((round(im.width * KF), round(im.height * KF)), Image.LANCZOS)
    save(im, 'kicker-follow')
    print('kicker-follow', im.size, 'anchor', [round(v * KF, 1) for v in fanc], 'px a yard', round(425 * KK, 1))
