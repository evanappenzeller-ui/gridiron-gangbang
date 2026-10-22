# The Keep's pictures (img/realm/*.webp and the frame tables in js/views/realm-sprites.js) from the Game of
# Thrones-inspired sprite sheets (Oct 2026): four buildings ten levels each (the Castle, id keep; the gold mine, the archer tower,
# the dragon hatchery), and the folk: twelve villagers at work, three archers loosing and nine cannon crew.
#   python3 tools/realm/sprites.py <the folder the three zips were unpacked into: GOT_Inspired_Sprites>
# Each sheet is a grid (README: buildings 5 x 2, eight poses 4 x 2, four poses 2 x 2, read in rows); a frame is the
# connected shapes whose middle falls in its cell (an arm or a flag reaches into the next cell now and then), specks
# dropped. Buildings: a family's frames at one scale (so a level-1 hut stands smaller than a level-10 castle on the
# same ground), each anchored at its base's front point, its base's width noted (the widest it is in its bottom
# 40%). Folk: a sheet's frames at one scale, a standing figure TALL px, anchored at the feet (so a pose sequence
# stays put as it plays). Everything's packed into one atlas per building and one for the folk.
import sys, os, re
from collections import deque
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT_IMG, OUT_JS = 'img/realm', 'js/views/realm-sprites.js'
BUILD_S = 1           # a building sheet's scale in its atlas (the art's own size: a Keep fills a phone close up)
TALL = 96            # px: a standing figure's height in the folk atlas
BUILDINGS = {
    'keep': '01_buildings/northern_keep_levels_01-10.png',
    'mine': '01_buildings/gold_mine_treasury_levels_01-10.png',
    'tower': '01_buildings/defense_tower_levels_01-10.png',
    'hatchery': '01_buildings/dragon_hatchery_levels_01-10.png',
}
V, A, C = '02_character_actions/villagers/', '02_character_actions/archers/', '02_character_actions/cannon_crew/'
FOLK = {
    'farmer': V + 'v01_farmer_pitchfork_8poses.png', 'harvest': V + 'v02_farmer_inspect_harvest_4poses.png',
    'smith': V + 'v03_blacksmith_hammer_8poses.png', 'tongs': V + 'v04_blacksmith_tongs_8poses.png',
    'chop': V + 'v05_lumberjack_chop_8poses.png', 'timber': V + 'v06_woodworker_inspect_timber_4poses.png',
    'sack': V + 'v07_merchant_hoist_sack_4poses.png', 'fabric': V + 'v08_merchant_inspect_fabric_4poses.png',
    'feed': V + 'v09_stablehand_feed_grain_4poses.png', 'hay': V + 'v10_stablehand_place_hay_4poses.png',
    'firewood': V + 'v11_northerner_sort_firewood_4poses.png', 'lantern': V + 'v12_northerner_lantern_4poses.png',
    'archer1': A + 'a01_militia_fire_8poses.png', 'archer2': A + 'a02_ranger_fire_8poses.png', 'archer3': A + 'a03_elite_fire_8poses.png',
    'powder1': C + 'c01_militia_powder_loading_8poses.png', 'ball1': C + 'c02_militia_cannonball_8poses.png',
    'ram1': C + 'c03_militia_ramrod_corrected_8poses.png', 'fire2': C + 'c04_northern_ignition_8poses.png',
    'ball2': C + 'c05_northern_cannonball_8poses.png', 'scoop2': C + 'c06_northern_powder_scoop_4poses.png',
    'fire3': C + 'c07_royal_ignition_8poses.png', 'ball3': C + 'c08_royal_cannonball_8poses.png',
    'ram3': C + 'c09_royal_ramrod_corrected_8poses.png',
}

def load(p):
    a = np.array(Image.open(os.path.join(SRC, p)).convert('RGBA'))
    al = a[:, :, 3].astype(np.int32)
    al[al <= 8] = 0
    a[:, :, 3] = al.astype(np.uint8)
    return a

def components(mask, k=3):
    """Connected shapes of a mask, looked at k x k px at a time: (labels (the k-small grid, 0 none, n the nth shape),
    [(count, y0, x0, y1, x1, cy, cx)] at full size)."""
    small = mask[::k, ::k]
    h, w = small.shape
    lab = np.zeros(small.shape, dtype=np.int32)
    out = []
    for y0, x0 in zip(*np.nonzero(small)):
        if lab[y0, x0]: continue
        n = len(out) + 1
        q = deque([(y0, x0)]); lab[y0, x0] = n; ys = []; xs = []
        while q:
            y, x = q.popleft(); ys.append(y); xs.append(x)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n; q.append((ny, nx))
        ys = np.array(ys); xs = np.array(xs)
        out.append((len(ys), ys.min() * k, xs.min() * k, (ys.max() + 1) * k, (xs.max() + 1) * k, ys.mean() * k, xs.mean() * k))
    return lab, out

def frames(a, cols, rows, k=3):
    """The sheet's frames in reading order: an RGBA crop each (the cell's shapes only). Two figures that touch (one
    shape across two cells) are cut apart where they're thinnest between the cells' middles."""
    H, W = a.shape[:2]
    mask = a[:, :, 3] > 24
    lab, comps = components(mask, k)
    big = max(c[0] for c in comps)
    med = np.median([c[0] for c in comps if c[0] > big * .3])
    cw, ch = W / cols, H / rows
    cell = np.zeros(lab.shape, dtype=np.int32) - 1      # (each small px: the cell it goes to)
    for n, c in enumerate(comps, 1):
        if c[0] < big * .002: continue                   # specks
        m = lab == n
        row = min(rows - 1, int(c[5] / ch))
        mids = [j for j in range(cols) if c[2] <= (j + .5) * cw <= c[4]]  # (the cells whose middles it spans)
        col = min(cols - 1, int(c[6] / cw))
        if c[0] > med * 1.5 and len(mids) == 2:
            c0 = mids[0]
            # two figures: cut between the two cells' middles where the shape is thinnest
            a0, a1 = int((c0 + .5) * cw / k), int((c0 + 1.5) * cw / k)
            prof = m[:, a0:a1].sum(axis=0)
            cut = a0 + int(np.argmin(prof))
            xs = np.arange(lab.shape[1])[None, :].repeat(lab.shape[0], axis=0)
            cell[m & (xs < cut)] = row * cols + c0
            cell[m & (xs >= cut)] = row * cols + c0 + 1
        else:
            cell[m] = row * cols + col
    out = []
    for i in range(cols * rows):
        keep = np.repeat(np.repeat(cell == i, k, axis=0), k, axis=1)[:H, :W]
        keep = np.pad(keep, ((0, H - keep.shape[0]), (0, W - keep.shape[1])))
        # (a px's k x k block may hold a neighbour's edge: grow the keep a block so nothing of this one is lost)
        grown = keep.copy()
        grown[k:] |= keep[:-k]; grown[:-k] |= keep[k:]; grown[:, k:] |= keep[:, :-k]; grown[:, :-k] |= keep[:, k:]
        crop = a.copy()
        crop[~grown] = 0
        ys, xs = np.nonzero(crop[:, :, 3] > 24)
        out.append(crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    return out

def scaled(crop, s):
    im = Image.fromarray(crop)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

def base_of(im):
    """A building's base: (the middle of its widest span in its bottom 40%, its bottom, that span's width), px."""
    al = np.array(im)[:, :, 3] > 60
    h = al.shape[0]
    ys, xs = np.nonzero(al[int(h * .6):])
    x0, x1 = xs.min(), xs.max() + 1
    rows = np.nonzero(al.any(axis=1))[0]
    return (x0 + x1) / 2, rows.max() + 1, x1 - x0

def feet_of(im):
    """Where a figure stands: the middle of what's in its bottom 6% (its boots), and its bottom, px."""
    al = np.array(im)[:, :, 3] > 60
    rows = np.nonzero(al.any(axis=1))[0]
    bot = rows.max() + 1
    ys, xs = np.nonzero(al[max(0, bot - max(4, int(im.height * .06))):bot])
    return (xs.min() + xs.max() + 1) / 2, bot

def pack(ims, width, pad=2):
    """Shelf-packs pictures into an atlas `width` wide: (atlas, [(x, y)])."""
    order = sorted(range(len(ims)), key=lambda i: -ims[i].height)
    at = [None] * len(ims)
    x = y = pad; shelf = 0
    for i in order:
        w, h = ims[i].size
        if x + w + pad > width: x = pad; y += shelf + pad; shelf = 0
        at[i] = (x, y); x += w + pad; shelf = max(shelf, h)
    H = y + shelf + pad
    H = (H + 3) // 4 * 4
    out = Image.new('RGBA', (width, H), (0, 0, 0, 0))
    for im, p in zip(ims, at): out.paste(im, p)
    return out, at

def save(img, name, q=84):
    img.save(f'{OUT_IMG}/{name}.webp', 'WEBP', quality=q, alpha_quality=90, method=6)

os.makedirs(OUT_IMG, exist_ok=True)
lines = []
# ---- the buildings
lines.append('/** Buildings: per family, a frame per level [x, y, w, h, ax, ay, bw] (px in img/realm/<family>.webp; ax, ay')
lines.append(' *  the front point of its base, bw its base\'s width). */')
lines.append('export const BUILD = {')
for k, p in BUILDINGS.items():
    fr = frames(load(p), 5, 2)
    ims = [scaled(f, BUILD_S) for f in fr]
    atlas, at = pack(ims, 2048)
    save(atlas, k, 80)
    rows = []
    for im, (x, y) in zip(ims, at):
        ax, ay, bw = base_of(im)
        rows.append(f'[{x}, {y}, {im.width}, {im.height}, {ax:.1f}, {ay:.1f}, {bw}]')
    lines.append(f"  {k}: {{w: {atlas.width}, h: {atlas.height}, f: [{', '.join(rows)}]}},")
    print(k, atlas.size, os.path.getsize(f'{OUT_IMG}/{k}.webp') // 1024, 'KB')
lines.append('};')
# ---- the folk
ims, names = [], []
for k, p in FOLK.items():
    n = 8 if '8poses' in p else 4
    fr = frames(load(p), 4 if n == 8 else 2, 2)
    hs = sorted(f.shape[0] for f in fr)
    s = TALL / hs[len(hs) // 2]
    for i, f in enumerate(fr):
        ims.append(scaled(f, s)); names.append((k, i))
atlas, at = pack(ims, 2048)
save(atlas, 'folk', 80)
print('folk', atlas.size, os.path.getsize(f'{OUT_IMG}/folk.webp') // 1024, 'KB')
lines.append(f'/** The folk: per sheet, its poses in order [x, y, w, h, ax, ay] (px in img/realm/folk.webp; ax, ay where the feet')
lines.append(f' *  are). A standing figure is TALL px. */')
lines.append(f'export const TALL = {TALL};')
lines.append(f'export const FOLK_SIZE = [{atlas.width}, {atlas.height}];')
lines.append('export const FOLK = {')
for k in FOLK:
    rows = []
    for (kk, i), im, (x, y) in zip(names, ims, at):
        if kk != k: continue
        fx, fy = feet_of(im)
        rows.append(f'[{x}, {y}, {im.width}, {im.height}, {fx:.1f}, {fy:.1f}]')
    lines.append(f"  {k}: [{', '.join(rows)}],")
lines.append('};')

js = open(OUT_JS).read() if os.path.exists(OUT_JS) else '// <frames>\n// </frames>\n'
block = '// <frames> (tools/realm/sprites.py writes this)\n' + '\n'.join(lines) + '\n// </frames>'
js = re.sub(r'// <frames>.*?// </frames>', lambda m: block, js, flags=re.S)
open(OUT_JS, 'w').write(js)
