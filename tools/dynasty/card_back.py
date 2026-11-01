"""The Rivals card reverse, from the owner's picture (tools/dynasty/src/card-back-source.png).

Nov 1 2026, Evan: "Use the attached for the back of the cards", then "Remove the bottom text and make the top text and
football larger". The wordmark block (GRIDIRON / RIVALS / TRADING CARD GAME) and the football are lifted off the picture
by colour (gold, cream and their dark outlines; the shards are all blue), the shards are filled back in where they were
(nearest shard colour, so the edges stay sharp), the mirrored bottom wordmark is dropped, and the top block and the
football go back larger with a soft shadow. Sized to 63:88, the screenshot's corners cut on the card's rounded outline.
Writes img/rivals/card-back-v<VERSION>.webp; give changed output a new VERSION (sw.js keeps pictures across releases).
Usage: python3 tools/dynasty/card_back.py [--preview=<png>]
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

VERSION = 2
ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'tools/dynasty/src/card-back-source.png', ROOT / f'img/rivals/card-back-v{VERSION}.webp'
W, H = 630, 880          # 63:88
INNER = (75, 70, 855, 1225)   # inside the frame's printed border line (source pixels)
TOP = (95, 330)          # the wordmark block's rows, GRIDIRON to TRADING CARD GAME
BALL = (440, 850)        # the football's rows
TEXT_SCALE, BALL_SCALE = 1.35, 1.45
TEXT_TOP, BALL_CY = 92, 800   # where they go (source pixels)


def disc(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def art_mask(im):
    """Gold/cream lettering, the ball and their dark outlines: the shards never have red over 110 or blue under 62."""
    b, r = im[:, :, 0].astype(int), im[:, :, 2].astype(int)
    m = ((r > 110) | (b < 62)).astype(np.uint8)
    keep = np.zeros_like(m)
    x0, y0, x1, y1 = INNER
    keep[y0:y1, x0:x1] = m[y0:y1, x0:x1]
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, disc(4))
    n, lab, st, _ = cv2.connectedComponentsWithStats(keep)
    out = np.zeros_like(keep)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 40:
            out[lab == i] = 1
    return out > 0


def fill(im, hole):
    """Each hole pixel takes its nearest shard's colour (sharp polygon edges, like the print), then a light median."""
    _, lab = cv2.distanceTransformWithLabels(hole.astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    zy, zx = np.nonzero(~hole)
    ly = np.zeros(lab.max() + 1, int); lx = np.zeros(lab.max() + 1, int)
    ly[lab[zy, zx]] = zy; lx[lab[zy, zx]] = zx
    out = cv2.medianBlur(im[ly[lab], lx[lab]], 7)
    return np.where(hole[..., None], out, im)


def piece(rgb, mask, rows):
    """The art in those rows as an RGBA cut-out (alpha softened half a pixel), cropped to its box."""
    a = np.zeros(mask.shape, np.uint8)
    a[rows[0]:rows[1]] = mask[rows[0]:rows[1]] * 255
    a = cv2.GaussianBlur(cv2.dilate(a, disc(1)), (3, 3), 0)
    ys, xs = np.nonzero(a)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    return Image.fromarray(np.dstack([rgb, a])).crop(box), box


def place(canvas, cut, scale, cx, top=None, cy=None):
    w, h = round(cut.width * scale), round(cut.height * scale)
    big = cut.resize((w, h), Image.LANCZOS)
    x = round(cx - w / 2); y = round(top if top is not None else cy - h / 2)
    shadow = Image.new('RGBA', (w + 80, h + 80), (0, 0, 0, 0))
    sa = Image.new('L', shadow.size, 0); sa.paste(big.getchannel('A'), (40, 40))
    sa = sa.filter(ImageFilter.GaussianBlur(9)).point(lambda v: int(v * .6))
    shadow.paste((4, 18, 52, 255), (0, 0), sa)
    canvas.alpha_composite(shadow, (x - 40, y - 40 + 7))
    canvas.alpha_composite(big, (x, y))


def build():
    bgr = cv2.imread(str(SRC))
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    art = art_mask(bgr)
    # the art's dark glow too (darker than any shard), then a margin
    near = cv2.dilate(art.astype(np.uint8), disc(30)) > 0
    hole = cv2.dilate((art | (near & (bgr[:, :, 0] < 76))).astype(np.uint8), disc(5)) > 0
    clean = cv2.cvtColor(fill(bgr, hole), cv2.COLOR_BGR2RGB)
    canvas = Image.fromarray(clean).convert('RGBA')
    words, _ = piece(rgb, art, TOP)
    ball, bbox = piece(rgb, art, BALL)
    mid = (INNER[0] + INNER[2]) / 2
    place(canvas, words, TEXT_SCALE, mid, top=TEXT_TOP)
    place(canvas, ball, BALL_SCALE, (bbox[0] + bbox[2]) / 2, cy=BALL_CY)
    card = canvas.convert('RGB').resize((W, H), Image.LANCZOS)
    ss = 4
    m = Image.new('L', (W * ss, H * ss), 0)
    # matches .pk-flip-back's border-radius: 5% / 3.6%
    ImageDraw.Draw(m).rounded_rectangle((0, 0, W * ss - 1, H * ss - 1), radius=int(.05 * W * ss), fill=255)
    card.putalpha(m.resize((W, H), Image.LANCZOS))
    card.save(OUT, 'WEBP', quality=86, method=6)
    print(OUT.relative_to(ROOT), OUT.stat().st_size, 'bytes')
    for a in sys.argv[1:]:
        if a.startswith('--preview='):
            card.save(a[10:])


if __name__ == '__main__':
    build()
