# The Two-Minute Drill's players (img/drill/players.webp, players-mask.webp and the frame table in
# js/views/drill-sprites.js) from the five sprite sheets: the defense (green and gold), the offensive line, receivers,
# backs (with the ball) and the quarterback (blue and white).
#   python3 tools/drill/sprites.py <def.png> <ol.png> <wr.png> <rb.png> <qb.png>
# Each sheet's figures are its connected shapes (small bits join the nearest figure), read in rows; every one is named
# below (NAMES), cropped, scaled so a sheet's runners all stand the same height (TALL px) and packed into one atlas.
# The uniform is taken out so the game can put any team's colours on it: the jersey (blue on offense, green on
# defense, with the helmet, socks and stripes that share its colour) and the pants (white on offense; gold on
# defense, with its helmet) are left in grey, their light and shade kept (the grey is half the shade: 0.5 is the
# uniform's own colour), and the mask says which is which (red: jersey, green: pants, blue: helmet: the small
# patch of the helmet's colour at the head, so it can stay in the team's colour whichever jersey is worn), soft at the
# edges.
import sys, re, json
from collections import deque
import numpy as np
from PIL import Image

OUT_IMG, OUT_JS = 'img/drill', 'js/views/drill-sprites.js'
TALL = 112           # px: a runner's height in the atlas (a player is at most about 100 px tall on a phone)
# Each sheet's figures, in reading order. r_* runs (b: from behind, f: from the front, l / r: going left / right, two
# strides each); the rest the play's moments.
NAMES = {
    'def': ['r_b0', 'r_b1', 'r_f0', 'r_f1', 'r_l0', 'r_l1', 'r_r0', 'r_r1', 'stance', 'swim', 'rip', 'hands',
            'reach', 'dive', 'lunge', 'fallen', 'juked', 'flat', 'leap', 'pick'],
    'ol': ['r_b0', 'r_b1', 'r_f0', 'r_f1', 'r_l0', 'r_l1', 'r_r0', 'r_r1', 'stance', 'pass', 'drive', 'cut',
           'set', 'reach', 'lunge', 'fallen'],
    'wr': ['r_b0', 'r_b1', 'r_f0', 'r_f1', 'r_l0', 'r_l1', 'r_r0', 'r_r1', 'catch', 'high', 'onehand', 'layout',
           'fumble', 'after', 'dive', 'down'],
    'rb': ['r_b0', 'r_b1', 'r_f0', 'r_f1', 'r_l0', 'r_l1', 'r_r0', 'r_r1', 'juke', 'stiff_r', 'stiff_b', 'high',
           'hurdle', 'stiff_f', 'spin', 'take', 'dive', 'lunge', 'falling', 'down'],
    'qb': ['r_b0', 'r_b1', 'r_f0', 'r_f1', 'r_l0', 'r_l1', 'r_r0', 'r_r1', 'set', 'handoff', 'tuck', 'windup',
           'release', 'dive', 'falling', 'down'],
}
# On the ground (anchored a little up from the figure's bottom, so it lies round the spot rather than in front of it).
FLAT = {'fallen', 'dive', 'flat', 'layout', 'down', 'falling'}
# Where the head is, as a share of the figure's box, when it isn't in the top third: (x, y, how near).
HEAD = {'def.dive': (.5, .35, .2), 'def.fallen': (.8, .7, .2), 'def.flat': (.5, .12, .15), 'def.reach': (.45, .3, .25),
        'ol.fallen': (.75, .45, .25), 'ol.lunge': (.75, .25, .2), 'ol.cut': (.65, .2, .2), 'ol.drive': (.55, .25, .25),
        'wr.layout': (.8, .4, .3), 'wr.down': (.75, .5, .25), 'wr.dive': (.6, .35, .3), 'wr.high': (.55, .38, .2),
        'wr.onehand': (.6, .4, .2),
        'rb.dive': (.75, .3, .25), 'rb.falling': (.3, .25, .25), 'rb.down': (.2, .45, .25), 'rb.lunge': (.65, .25, .25),
        'qb.dive': (.75, .25, .25), 'qb.falling': (.15, .3, .2), 'qb.down': (.15, .4, .25)}

def load(p):
    a = np.array(Image.open(p).convert('RGBA'))
    al = a[:, :, 3].astype(np.int32)
    al[al <= 8] = 0
    al = np.minimum(255, (al * 255) // 253)
    a[:, :, 3] = al.astype(np.uint8)
    return a

def components(mask, k=2):
    small = mask[::k, ::k]
    h, w = small.shape
    seen = np.zeros_like(small, dtype=bool)
    out = []
    for y0, x0 in zip(*np.nonzero(small)):
        if seen[y0, x0]: continue
        q = deque([(y0, x0)]); seen[y0, x0] = True; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
        ys = np.array([p[0] for p in pts]) * k; xs = np.array([p[1] for p in pts]) * k
        out.append({'n': len(pts), 'ys': ys, 'xs': xs, 'box': (xs.min(), ys.min(), xs.max(), ys.max())})
    return out

def figures(a, big=1500):
    comps = components(a[:, :, 3] > 100)
    bigs = [c for c in comps if c['n'] >= big]
    for c in comps:
        if c['n'] >= big or c['n'] < 12: continue
        cx, cy = c['xs'].mean(), c['ys'].mean()
        def dist(b):
            x0, y0, x1, y1 = b['box']
            return max(x0 - cx, 0, cx - x1) + max(y0 - cy, 0, cy - y1)
        tgt = min(bigs, key=dist)
        if dist(tgt) < 60:
            tgt['ys'] = np.concatenate([tgt['ys'], c['ys']]); tgt['xs'] = np.concatenate([tgt['xs'], c['xs']])
    for b in bigs:
        b['box'] = (b['xs'].min(), b['ys'].min(), b['xs'].max(), b['ys'].max()); b['cy'] = b['ys'].mean(); b['cx'] = b['xs'].mean()
    bigs.sort(key=lambda b: b['cy'])
    hs = np.median([b['box'][3] - b['box'][1] for b in bigs])
    rows, cur = [], [bigs[0]]
    for b in bigs[1:]:
        if b['cy'] - np.mean([c['cy'] for c in cur]) > hs * 0.45: rows.append(cur); cur = [b]
        else: cur.append(b)
    rows.append(cur)
    out = []
    for r in rows: out += sorted(r, key=lambda b: b['cx'])
    return out

def grow(m, n=3):
    g = m.copy()
    for _ in range(n):
        g[1:, :] |= g[:-1, :]; g[:-1, :] |= g[1:, :]; g[:, 1:] |= g[:, :-1]; g[:, :-1] |= g[:, 1:]
    return g

def uniform(a, sheet):
    """Masks of the jersey and the pants (full size), and each one's own luminance (its median)."""
    rgb = a[:, :, :3].astype(np.float32) / 255
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx, mn = rgb.max(2), rgb.min(2)
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    on = a[:, :, 3] > 100
    if sheet == 'def':
        J = on & (h >= 85) & (h <= 175) & (s > 0.25) & (mx > 0.05)
        P = on & (h >= 38) & (h <= 62) & (s > 0.3) & (mx > 0.3)
    else:
        J = on & (h >= 200) & (h <= 255) & (s > 0.3) & (mx > 0.06)
        P = on & (s < 0.16) & (mx > 0.66)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    return J, P, lum, float(np.median(lum[J])), float(np.median(lum[P]))

srcs = dict(zip(['def', 'ol', 'wr', 'rb', 'qb'], sys.argv[1:6]))
tiles = []
for sheet, src in srcs.items():
    a = load(src)
    figs = figures(a)
    names = NAMES[sheet]
    assert len(figs) == len(names), f'{sheet}: {len(figs)} figures, {len(names)} names'
    J, P, lum, refJ, refP = uniform(a, sheet)
    # the uniform in grey: half its shade
    art = a.copy()
    for M, ref in ((J, refJ), (P, refP)):
        gv = (np.clip(lum / ref * 0.5, 0, 1) * 255).astype(np.uint8)
        for c in range(3): art[:, :, c] = np.where(M, gv, art[:, :, c])
    runH = np.median([f['box'][3] - f['box'][1] for f in figs[:4]])
    k = TALL / runH
    H, W = a.shape[:2]
    for f, nm in zip(figs, names):
        fm = np.zeros((H, W), dtype=bool)
        for dy in (0, 1):
            for dx in (0, 1):
                fm[np.clip(f['ys'] + dy, 0, H - 1), np.clip(f['xs'] + dx, 0, W - 1)] = True
        g = grow(fm)
        x0, y0, x1, y1 = f['box']
        x0, y0, x1, y1 = max(0, x0 - 3), max(0, y0 - 3), min(W, x1 + 5), min(H, y1 + 5)
        piece = art[y0:y1, x0:x1].copy(); piece[~g[y0:y1, x0:x1], 3] = 0
        mask = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        Jf, Pf = J[y0:y1, x0:x1] & g[y0:y1, x0:x1], P[y0:y1, x0:x1] & g[y0:y1, x0:x1]
        # the helmet: on offense part of the jersey's colour, on defense of the pants'; the smaller patches of it
        # (the stripe splits it) high on the figure, or (on the ground) wherever the head is (HEAD)
        U = Jf if sheet != 'def' else Pf
        Hf = np.zeros_like(U)
        cs = [c for c in components(U, 1) if c['n'] >= 20]
        if cs:
            top = max(c['n'] for c in cs)
            hy0 = HEAD.get(f'{sheet}.{nm}', (0, .36))
            for c in cs:
                cyr, cxr = c['ys'].mean() / U.shape[0], c['xs'].mean() / U.shape[1]
                inHead = hy0[0] <= cyr <= hy0[1] if len(hy0) == 2 else (abs(cxr - hy0[0]) < hy0[2] and abs(cyr - hy0[1]) < hy0[2])
                if c['n'] < top * .45 and inHead: Hf[c['ys'], c['xs']] = True
        Hf = grow(Hf, 1) & U
        mask[:, :, 0] = (Jf & ~Hf) * 255
        mask[:, :, 1] = (Pf & ~Hf) * 255
        mask[:, :, 2] = Hf * 255
        mask[:, :, 3] = 255
        tw, th = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
        im = Image.fromarray(piece).resize((tw, th), Image.LANCZOS)
        mk = Image.fromarray(mask).resize((tw, th), Image.BILINEAR)
        ys, xs = np.nonzero(np.array(im)[:, :, 3] > 100)
        ax, ay = float(xs.mean()), float(ys.max())
        if nm in FLAT: ay = ys.max() - 0.22 * (ys.max() - ys.min())
        # a ball in the picture (backs and passers with it, the catches with it in hand)
        ball = (sheet in ('rb', 'qb') and nm not in ('dive', 'release')) or nm in ('catch', 'high', 'onehand', 'layout', 'after', 'down', 'pick', 'fumble')
        tiles.append({'key': f'{sheet}.{nm}', 'im': im, 'mk': mk, 'ax': round(ax, 1), 'ay': round(ay, 1), 'ball': bool(ball)})
    print(sheet, len(figs), 'figures; scale', round(k, 3), 'refs', round(refJ, 3), round(refP, 3))

# pack: shelves, tallest first
pad, AW = 2, 1024
order = sorted(tiles, key=lambda t: -t['im'].height)
x = y = pad; rowh = 0
for t in order:
    if x + t['im'].width + pad > AW: x = pad; y += rowh + pad; rowh = 0
    t['x'], t['y'] = x, y
    x += t['im'].width + pad; rowh = max(rowh, t['im'].height)
AH = y + rowh + pad
atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
maskA = Image.new('RGB', (AW, AH), (0, 0, 0))
for t in tiles:
    atlas.paste(t['im'], (t['x'], t['y']))
    maskA.paste(t['mk'].convert('RGB'), (t['x'], t['y']), t['im'])
atlas.save(f'{OUT_IMG}/players.webp', 'WEBP', quality=82, method=6)
# the mask in 8 steps a colour, lossless (it has to come back exactly)
maskA = maskA.point(lambda v: 0 if v < 18 else min(255, round(v / 255 * 7) * 255 // 7))
maskA.save(f'{OUT_IMG}/players-mask.webp', 'WEBP', lossless=True, quality=100, method=6)
print('atlas', atlas.size)

# the frame table, into drill-sprites.js between its markers
rows = ',\n'.join(f"  '{t['key']}': [{t['x']}, {t['y']}, {t['im'].width}, {t['im'].height}, {t['ax']}, {t['ay']}{', 1' if t['ball'] else ''}]" for t in tiles)
js = open(OUT_JS).read()
block = f'// <frames> (tools/drill/sprites.py writes this)\n/** A runner\'s height in the atlas, px. */\nexport const TALL = {TALL};\nconst FRAMES = {{\n{rows}\n}};\n// </frames>'
js2 = re.sub(r'// <frames>.*?// </frames>', lambda m: block, js, flags=re.S)
assert js2 != js or block in js, 'markers not found'
open(OUT_JS, 'w').write(js2)
print('frames', len(tiles), 'written to', OUT_JS)
