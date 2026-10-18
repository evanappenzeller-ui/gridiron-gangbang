#!/usr/bin/env python3
"""Draws the Daily Games switch badges, img/puzzles.webp, img/seventeen.webp, img/drill.webp and img/kick.webp (puzzles.js): pixel
art on a 32x32 grid scaled x4 (nearest) to 128x128, like img/nfl.webp (the Two-Minute Drill's and Kick It's are smooth). Run: python3 tools/seventeen/badges.py (needs Pillow; then bump
CACHE in sw.js)."""
import os
from PIL import Image, ImageDraw
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'img')
N = 32

def finish(im, name):
    big = im.resize((128, 128), Image.NEAREST)
    big.save(f'{OUT}/{name}.webp', 'WEBP', lossless=True)

# ---- Daily Puzzles: a 3x3 puzzle board, tiles solved green, one gold, the rest open, a dark frame and a hard shadow.
im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
INK, FRAME, BOARD = (10, 14, 34, 255), (232, 238, 255, 255), (34, 52, 104, 255)
GREEN, GREEN_D, GOLD, GOLD_D, OPEN, OPEN_D = (124, 240, 88, 255), (62, 154, 43, 255), (255, 197, 49, 255), (176, 120, 0, 255), (86, 112, 186, 255), (52, 72, 132, 255)
d.rounded_rectangle((3, 4, 30, 31), 4, fill=(0, 0, 0, 140))           # shadow
d.rounded_rectangle((1, 2, 28, 29), 4, fill=INK)                      # outline
d.rounded_rectangle((2, 3, 27, 28), 3, fill=FRAME)                    # frame
d.rounded_rectangle((4, 5, 25, 26), 2, fill=BOARD)                    # board
tiles = ['g', 'g', 'y', 'o', 'g', 'o', 'g', 'o', 'o']
for i, t in enumerate(tiles):
    x, y = 5 + (i % 3) * 7, 6 + (i // 3) * 7
    top, bot = {'g': (GREEN, GREEN_D), 'y': (GOLD, GOLD_D), 'o': (OPEN, OPEN_D)}[t]
    d.rectangle((x, y, x + 5, y + 5), fill=bot)
    d.rectangle((x, y, x + 5, y + 4), fill=top)
    d.point((x + 1, y + 1), fill=(255, 255, 255, 140))
finish(im, 'puzzles')

# ---- 17-0: a stadium scoreboard, "17-0" in lit yellow bulbs, on two posts.
im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
POST, PANEL, TRIM, BULB, BULB_D = (120, 132, 160, 255), (12, 16, 30, 255), (255, 122, 47, 255), (255, 214, 74, 255), (80, 64, 20, 255)
d.rectangle((8, 22, 10, 30), fill=POST); d.rectangle((21, 22, 23, 30), fill=POST)              # posts
d.rectangle((9, 22, 9, 30), fill=(170, 182, 210, 255)); d.rectangle((22, 22, 22, 30), fill=(170, 182, 210, 255))
d.rectangle((2, 6, 31, 25), fill=(0, 0, 0, 140))                                               # shadow
d.rectangle((0, 4, 29, 23), fill=INK)                                                          # outline
d.rectangle((1, 5, 28, 22), fill=TRIM)                                                         # trim
d.rectangle((2, 6, 27, 21), fill=PANEL)                                                        # panel
for x in range(3, 27, 3): d.point((x, 7), fill=(255, 255, 255, 50))                            # light strip
F = {'1': ['01', '11', '01', '01', '01'], '7': ['111', '001', '010', '010', '010'],
     '-': ['00', '00', '11', '00', '00'], '0': ['111', '101', '101', '101', '111']}
x0, y0 = 4, 10
for ch in '17-0':
    for r, row in enumerate(F[ch]):
        for c, on in enumerate(row):
            if on == '1':
                d.rectangle((x0 + c * 2, y0 + r * 2, x0 + c * 2 + 1, y0 + r * 2 + 1), fill=BULB)
    x0 += len(F[ch][0]) * 2 + 1
d.rectangle((13, 1, 16, 4), fill=INK); d.rectangle((14, 2, 15, 4), fill=TRIM)                  # top light
finish(im, 'seventeen')

# ---- Two-Minute Drill: not pixel art (its game has a modern look). A stadium scoreboard drawn smooth at 4x and scaled
# down: a dark board in a silver frame on two posts, the teams' lights across the top, and the clock at 2:00 in glowing
# seven-segment digits.
from PIL import ImageFilter
S = 512
L, T, R, B = 16, 84, 496, 400                                                                  # the board's frame
def layer():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
def vgrad(box, top, bottom, radius):
    """A rounded box filled top to bottom from one colour to another."""
    x0, y0, x1, y1 = box
    g = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        gd.line((x0, y, x1, y), fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,))
    m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).rounded_rectangle(box, radius, fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(g, (0, 0), m)
    return out
im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
sh, d = layer(); d.rounded_rectangle((36, 120, 476, 480), 48, fill=(0, 0, 0, 150))
im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(20)))                                   # shadow
for x in (152, 332):                                                                           # posts
    im.alpha_composite(vgrad((x, 360, x + 28, 504), (176, 185, 200), (104, 113, 130), 8))
im.alpha_composite(vgrad((L, T, R, B), (238, 242, 248), (122, 132, 150), 50))                  # silver frame, lit on top
im.alpha_composite(vgrad((L + 13, T + 13, R - 13, B - 13), (30, 40, 62), (8, 12, 20), 38))     # the board
glow, g = layer()
off, o = layer()
for (x0, x1), col in (((64, 214), (10, 132, 255)), ((298, 448), (255, 107, 44))):             # the teams' lights
    g.rounded_rectangle((x0, 122, x1, 144), 11, fill=col + (255,))
AMBER, DIM = (255, 196, 46, 255), (255, 255, 255, 20)
def seg(x0, y0, x1, y1, t):
    """A segment from (x0, y0) to (x1, y1), horizontal or vertical, pointed at both ends."""
    h = t / 2
    if y0 == y1:
        return [(x0, y0), (x0 + h, y0 - h), (x1 - h, y0 - h), (x1, y0), (x1 - h, y0 + h), (x0 + h, y0 + h)]
    return [(x0, y0), (x0 + h, y0 + h), (x0 + h, y1 - h), (x0, y1), (x0 - h, y1 - h), (x0 - h, y0 + h)]
def digit(x, y, n, w=82, hgt=176, t=24, gap=6):
    m = y + hgt / 2
    segs = {
        'a': (x + gap, y, x + w - gap, y), 'd': (x + gap, y + hgt, x + w - gap, y + hgt), 'g': (x + gap, m, x + w - gap, m),
        'f': (x, y + gap, x, m - gap), 'b': (x + w, y + gap, x + w, m - gap),
        'e': (x, m + gap, x, y + hgt - gap), 'c': (x + w, m + gap, x + w, y + hgt - gap)}
    for k, box in segs.items():
        (g if k in {'2': 'abged', '0': 'abcdef'}[n] else o).polygon(seg(*box, t), fill=AMBER if k in {'2': 'abged', '0': 'abcdef'}[n] else DIM)
y = 182                                                                                        # 2 : 0 0, centred
digit(68, y, '2'); digit(250, y, '0'); digit(368, y, '0')
for cy in (y + 54, y + 122):                                                                   # the colon
    g.ellipse((200 - 13, cy - 13, 200 + 13, cy + 13), fill=AMBER)
im.alpha_composite(off)
im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))
im.alpha_composite(glow)
hl, d = layer(); d.rounded_rectangle((L + 34, T + 20, R - 34, T + 96), 28, fill=(255, 255, 255, 16))
im.alpha_composite(hl.filter(ImageFilter.GaussianBlur(8)))                                     # a soft glass highlight
im.resize((128, 128), Image.LANCZOS).save(f'{OUT}/drill.webp', 'WEBP', lossless=True)

# ---- Kick It: smooth, like the Drill's. The goalposts in gold with the orange ribbons on top, and the ball tumbling
# through them over the bar, a white streak behind it.
im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
GOLD_T, GOLD_B = (255, 226, 92), (214, 150, 18)
def pole(box):
    """A post: gold, lit on its left edge."""
    x0, y0, x1, y1 = box
    g = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    for x in range(x0, x1 + 1):
        t = (x - x0) / max(1, x1 - x0)
        gd.line((x, y0, x, y1), fill=tuple(int(a + (b - a) * t) for a, b in zip(GOLD_T, GOLD_B)) + (255,))
    m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).rounded_rectangle(box, min(x1 - x0, y1 - y0) // 2, fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(g, (0, 0), m)
    return out
sh, d = layer()
for box in ((92, 40, 126, 352), (386, 40, 420, 352), (92, 318, 420, 352), (239, 330, 273, 500)):
    d.rounded_rectangle((box[0] + 10, box[1] + 14, box[2] + 10, box[3] + 14), 16, fill=(0, 0, 0, 150))
im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12)))                                    # shadow
im.alpha_composite(vgrad((222, 430, 290, 504), (40, 76, 160), (22, 42, 104), 12))              # the padding at the base
for box in ((239, 330, 273, 440), (92, 40, 126, 352), (386, 40, 420, 352)):                    # the uprights, the stem
    im.alpha_composite(pole(box))
im.alpha_composite(vgrad((92, 318, 420, 352), GOLD_T, GOLD_B, 17))                             # the crossbar
rb, d = layer()
for x in (109, 403):                                                                           # the ribbons, blown right
    d.polygon([(x, 44), (x + 70, 58), (x + 62, 74), (x, 70)], fill=(255, 106, 43, 255))
im.alpha_composite(rb)
tr, d = layer()
for i, (w, a) in enumerate(((26, 70), (18, 46), (12, 28))):                                    # the streak behind the ball
    d.line([(150 - i * 34, 330 - i * 18), (238, 238)], fill=(255, 255, 255, a), width=w)
im.alpha_composite(tr.filter(ImageFilter.GaussianBlur(5)))
ball, d = layer()
d.ellipse((256 - 104, 196 - 62, 256 + 104, 196 + 62), fill=(122, 52, 21, 255))                # the ball
d.ellipse((256 - 92, 196 - 54, 256 + 70, 196 + 30), fill=(164, 80, 38, 255))                   # its lit top
d.ellipse((256 - 104, 196 - 62, 256 + 104, 196 + 62), outline=(64, 26, 8, 255), width=6)
for sx in (-1, 1):                                                                             # the stripes near the tips
    d.arc((256 + sx * 68 - 16, 196 - 50, 256 + sx * 68 + 16, 196 + 50), 0, 360, fill=(255, 255, 255, 220), width=7)
d.line((206, 182, 306, 182), fill=(255, 255, 255, 255), width=9)                               # the laces
for x in range(214, 304, 18):
    d.line((x, 168, x, 196), fill=(255, 255, 255, 255), width=7)
ball = ball.rotate(28, resample=Image.BICUBIC, center=(256, 196))
im.alpha_composite(ball)
hl, d = layer(); d.ellipse((170, 146, 300, 178), fill=(255, 255, 255, 40))
im.alpha_composite(hl.rotate(28, resample=Image.BICUBIC, center=(256, 196)).filter(ImageFilter.GaussianBlur(6)))
im.resize((128, 128), Image.LANCZOS).save(f'{OUT}/kick.webp', 'WEBP', lossless=True)
print('wrote img/puzzles.webp, img/seventeen.webp, img/drill.webp, img/kick.webp')
