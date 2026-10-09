#!/usr/bin/env python3
"""Draws the Daily Games switch badges, img/puzzles.webp and img/seventeen.webp (puzzles.js): pixel art on a 32x32
grid scaled x4 (nearest) to 128x128, like img/nfl.webp. Run: python3 tools/seventeen/badges.py (needs Pillow; then bump
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
print('wrote img/puzzles.webp, img/seventeen.webp')
