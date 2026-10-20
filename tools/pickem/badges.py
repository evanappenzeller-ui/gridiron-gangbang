"""The Pick'em tab's League and Survivor badges (img/league.webp, img/survivor.webp), in the pixel style of
img/nfl.webp and img/ncaa.webp: drawn on a 32 x 32 grid, a black outline, then blown up 4x (128 x 128).
League: a green shield with turf stripes, a gold football and GG. Survivor: a lit torch.
Run: python3 tools/pickem/badges.py (Pillow)"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'img')
N = 32


def outline(im, col=(10, 10, 14, 255)):
    """A 1-pixel dark edge round everything drawn (the pixel badges' look)."""
    px = im.load()
    out = im.copy()
    po = out.load()
    for y in range(N):
        for x in range(N):
            if px[x, y][3]:
                continue
            if any(0 <= x + dx < N and 0 <= y + dy < N and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                po[x, y] = col
    return out


def save(im, name):
    big = outline(im).resize((N * 4, N * 4), Image.NEAREST)
    big.save(os.path.join(OUT, name), lossless=True)
    print(name, os.path.getsize(os.path.join(OUT, name)), 'bytes')


G = ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.']   # 5 x 7


def league():
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # the shield: flat top, straight sides, a point at the bottom
    shield = [(4, 3), (27, 3), (27, 17), (24, 23), (16, 29), (8, 23), (4, 17)]
    d.polygon(shield, fill=(245, 245, 240, 255))                       # white rim
    inner = [(6, 5), (25, 5), (25, 16), (22.5, 21.5), (16, 26.5), (9.5, 21.5), (6, 16)]
    d.polygon(inner, fill=(31, 122, 58, 255))                          # turf
    for x in range(7, 25, 4):                                          # mowing stripes
        d.rectangle([x, 6, x + 1, 25], fill=(38, 140, 66, 255))
    im2 = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    m = Image.new('L', (N, N), 0)
    ImageDraw.Draw(m).polygon(inner, fill=255)
    im2.paste(im, (0, 0))
    base = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(base).polygon(shield, fill=(245, 245, 240, 255))
    base.paste(im2, (0, 0), m)
    im = base
    d = ImageDraw.Draw(im)
    # the ball across the top
    d.ellipse([11, 7, 20, 11], fill=(150, 78, 34, 255))
    d.line([(13, 9), (18, 9)], fill=(250, 250, 250, 255))
    for x in (14, 16):
        d.point((x, 8), fill=(250, 250, 250, 255)); d.point((x, 10), fill=(250, 250, 250, 255))
    # GG in gold, a shadow under it
    def letter(ox, oy, col):
        for r, row in enumerate(G):
            for c, ch in enumerate(row):
                if ch == '#':
                    d.rectangle([ox + c * 2 // 2 * 1, oy + r * 2 // 2], fill=col)
    for i, ox in enumerate((9, 17)):
        for r, row in enumerate(G):
            for c, ch in enumerate(row):
                if ch == '#':
                    d.point((ox + c + 1, 14 + r + 1), fill=(12, 60, 26, 255))
        for r, row in enumerate(G):
            for c, ch in enumerate(row):
                if ch == '#':
                    d.point((ox + c, 14 + r), fill=(255, 205, 74, 255))
    save(im, 'league.webp')


def survivor():
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # the handle, wrapped at the top, a little tilted
    d.polygon([(14, 14), (18, 14), (17, 30), (15, 30)], fill=(122, 74, 38, 255))
    d.line([(16, 15), (16, 29)], fill=(150, 96, 52, 255))
    d.rectangle([12, 12, 20, 15], fill=(196, 160, 102, 255))           # the wrap
    d.line([(12, 13), (20, 13)], fill=(160, 124, 74, 255))
    # the flame: red, orange, yellow, white at its heart
    d.polygon([(16, 1), (21, 6), (23, 9), (22, 12), (10, 12), (9, 9), (11, 6), (13, 7)], fill=(222, 52, 32, 255))
    d.polygon([(16, 4), (19, 7), (20, 10), (19, 12), (13, 12), (12, 10), (14, 8)], fill=(255, 140, 26, 255))
    d.polygon([(16, 7), (18, 9), (18, 11), (14, 11), (14, 9)], fill=(255, 222, 74, 255))
    d.point((16, 10), fill=(255, 255, 230, 255))
    # sparks
    for x, y, c in ((7, 4, (255, 140, 26, 255)), (24, 3, (255, 222, 74, 255)), (25, 7, (222, 52, 32, 255))):
        d.point((x, y), fill=c)
    save(im, 'survivor.webp')


league()
survivor()
