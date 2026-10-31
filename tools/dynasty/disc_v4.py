#!/usr/bin/env python3
"""Gridiron Rivals' disc (v4), drawn from the case's cover (img/games/dynasty-cover-v3.webp).

The owner (Oct 31 2026): "Change the disc to match the design of the front ... take inspiration from it".
Its holographic rainbow rim and gold bevel are the cover's foil card frame, the royal-blue face with its light
rays the cover's field, and the gold logo and the glowing football are lifted from the cover itself. The middle
stays a clear, see-through hole (the case's hub shows through it), the same size as before.

    python3 tools/dynasty/disc_v4.py   ->  img/games/dynasty-disc-v4.webp
"""
import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
COVER = os.path.join(ROOT, 'img/games/dynasty-cover-v3.webp')
OUT = os.path.join(ROOT, 'img/games/dynasty-disc-v4.webp')
FONT = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'

OUTSIZE = 706
K = 2                      # drawn at twice the size, then reduced
S = OUTSIZE * K
C = S / 2
R = S / 2 - 1 * K          # the disc's edge
FACE = 300 * K             # inside the gold bevel: the blue face
HOLE = 47 * K              # the clear hole over the hub
CLEAR = 66 * K             # the clear plastic ring round it


def radial(size, stops, center=None, radius=None):
    """An RGB radial gradient: stops are (t, (r, g, b)) from the middle out."""
    w, h = size
    cx, cy = center or (w / 2, h / 2)
    rad = radius or min(w, h) / 2
    small = 256
    grad = Image.new('RGB', (small, 1))
    for i in range(small):
        t = i / (small - 1)
        for j in range(len(stops) - 1):
            t0, c0 = stops[j]
            t1, c1 = stops[j + 1]
            if t0 <= t <= t1:
                f = (t - t0) / (t1 - t0) if t1 > t0 else 0
                grad.putpixel((i, 0), tuple(int(c0[k] + (c1[k] - c0[k]) * f) for k in range(3)))
                break
        else:
            grad.putpixel((i, 0), stops[-1][1])
    # distance map
    dist = Image.new('L', (w, h))
    px = dist.load()
    for y in range(h):
        dy = y - cy
        for x in range(w):
            d = math.hypot(x - cx, dy) / rad
            px[x, y] = min(255, int(d * 255))
    lut = [grad.getpixel((min(small - 1, v), 0)) for v in range(256)]
    r = dist.point([c[0] for c in lut])
    g = dist.point([c[1] for c in lut])
    b = dist.point([c[2] for c in lut])
    return Image.merge('RGB', (r, g, b))


def circle(size, r, blur=0, cx=None, cy=None):
    m = Image.new('L', (size, size), 0)
    cx = C if cx is None else cx
    cy = C if cy is None else cy
    ImageDraw.Draw(m).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur)) if blur else m


def ring(size, r0, r1, blur=0):
    return ImageChops.subtract(circle(size, r1, blur), circle(size, r0, blur))


def angle_map(size, n=1024):
    """Per pixel, the angle round the middle (0..255)."""
    small = 512
    m = Image.new('L', (small, small))
    px = m.load()
    for y in range(small):
        for x in range(small):
            a = math.atan2(y - small / 2, x - small / 2)
            px[x, y] = int(((a / (2 * math.pi)) % 1) * 255)
    return m.resize((size, size), Image.BILINEAR)


def holo(size):
    """The cover's rainbow foil: hues sweeping round, with sheen bands and a little grain."""
    hues = [(70, 220, 255), (40, 120, 255), (200, 90, 255), (255, 110, 200), (255, 220, 80),
            (140, 255, 140), (60, 230, 255), (90, 140, 255), (255, 120, 220), (255, 230, 90),
            (120, 255, 170), (70, 220, 255)]
    lut = []
    for i in range(256):
        t = i / 255 * (len(hues) - 1)
        j = min(int(t), len(hues) - 2)
        f = t - j
        lut.append(tuple(int(hues[j][k] + (hues[j + 1][k] - hues[j][k]) * f) for k in range(3)))
    a = angle_map(size)
    img = Image.merge('RGB', [a.point([c[k] for c in lut]) for k in range(3)])
    # streaky sheen across it, as the cover's foil catches the light
    rnd = random.Random(7)
    streak = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(streak)
    for _ in range(26):
        x = rnd.uniform(-size * .3, size * 1.3)
        w = rnd.uniform(6, 30) * K
        d.polygon([(x, 0), (x + w, 0), (x + w - size * .55, size), (x - size * .55, size)], fill=rnd.randint(15, 55))
    streak = streak.filter(ImageFilter.GaussianBlur(5 * K))
    img = Image.composite(Image.new('RGB', (size, size), (255, 255, 255)), img, streak)
    grain = Image.effect_noise((size, size), 28).filter(ImageFilter.GaussianBlur(.6 * K))
    img = ImageChops.overlay(img, Image.merge('RGB', [grain] * 3))
    return ImageEnhance.Brightness(ImageEnhance.Color(img).enhance(1.8)).enhance(.94)


def gold(size, r0, r1):
    """A gold bevel band between r0 and r1: lit above, shaded below, as the cover's card frames."""
    g = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(g)
    for y in range(size):
        t = y / size
        c = (int(255 - 70 * t), int(226 - 90 * t), int(120 - 80 * t))
        d.line([(0, y), (size, y)], fill=c)
    hi = ring(size, r1 - 2.2 * K, r1, .6 * K)
    g = Image.composite(Image.new('RGB', (size, size), (255, 248, 200)), g, hi.point(lambda v: v * .8))
    lo = ring(size, r0, r0 + 2 * K, .6 * K)
    g = Image.composite(Image.new('RGB', (size, size), (130, 80, 20)), g, lo.point(lambda v: v * .7))
    return g, ring(size, r0, r1, .5 * K)


def field(size):
    """The blue face: the cover's royal blue, brightest in the middle, with light rays and a starry dust."""
    f = radial((size, size), [(0, (90, 190, 255)), (.35, (40, 120, 245)), (.75, (20, 70, 205)), (1, (12, 40, 150))])
    rays = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(rays)
    rnd = random.Random(3)
    for i in range(36):
        a = i / 36 * 2 * math.pi + rnd.uniform(-.05, .05)
        w = rnd.uniform(.012, .035)
        d.polygon([(C, C), (C + math.cos(a - w) * S, C + math.sin(a - w) * S),
                   (C + math.cos(a + w) * S, C + math.sin(a + w) * S)], fill=rnd.randint(25, 60))
    rays = rays.filter(ImageFilter.GaussianBlur(6 * K))
    f = Image.composite(Image.new('RGB', (size, size), (170, 225, 255)), f, rays)
    dust = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(dust)
    for _ in range(260):
        x, y = rnd.uniform(0, size), rnd.uniform(0, size)
        r = rnd.uniform(.5, 1.6) * K
        d.ellipse((x - r, y - r, x + r, y + r), fill=rnd.randint(90, 230))
    dust = dust.filter(ImageFilter.GaussianBlur(.5 * K))
    f = Image.composite(Image.new('RGB', (size, size), (230, 245, 255)), f, dust)
    return f


def feathered(img, box, feather, shape='rect'):
    """Crop box out of img with soft edges (rect: rounded edges; ellipse: an oval)."""
    piece = img.crop(box).convert('RGBA')
    w, h = piece.size
    m = Image.new('L', (w, h), 0)
    inset = feather
    if shape == 'ellipse':
        ImageDraw.Draw(m).ellipse((inset, inset, w - inset, h - inset), fill=255)
    else:
        ImageDraw.Draw(m).rounded_rectangle((inset, inset, w - inset, h - inset), radius=feather * 2, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(feather / 2))
    piece.putalpha(m)
    return piece


def sparkle(img, x, y, r, alpha=255):
    """The cover's four-pointed glints."""
    layer = Image.new('L', img.size, 0)
    d = ImageDraw.Draw(layer)
    t = r * .12
    d.polygon([(x, y - r), (x + t, y - t), (x + r, y), (x + t, y + t), (x, y + r), (x - t, y + t), (x - r, y), (x - t, y - t)], fill=alpha)
    glow = layer.filter(ImageFilter.GaussianBlur(r * .25))
    halo = Image.new('L', img.size, 0)
    ImageDraw.Draw(halo).ellipse((x - r * .45, y - r * .45, x + r * .45, y + r * .45), fill=int(alpha * .7))
    halo = halo.filter(ImageFilter.GaussianBlur(r * .3))
    m = ImageChops.lighter(ImageChops.lighter(layer, glow), halo)
    white = Image.new('RGBA', img.size, (255, 255, 255, 255))
    img.alpha_composite(Image.composite(white, Image.new('RGBA', img.size, (0, 0, 0, 0)), m))


def arc_text(img, text, font, radius, center_deg, fill, stroke=None, spacing=1.0, bottom=True):
    """Letters set round the middle: along the bottom they read left to right, the right way up."""
    widths = [font.getlength(ch) for ch in text]
    total = sum(widths) * spacing
    span = total / radius                      # radians
    a = math.radians(center_deg) + (span / 2 if bottom else -span / 2)
    for ch, w in zip(text, widths):
        step = w * spacing / radius
        mid = a - step / 2 if bottom else a + step / 2
        pad = int(font.size * 1.6)
        tile = Image.new('RGBA', (pad, pad), (0, 0, 0, 0))
        d = ImageDraw.Draw(tile)
        sw = stroke[0] if stroke else 0
        d.text((pad / 2, pad / 2), ch, font=font, fill=fill, anchor='mm',
               stroke_width=sw, stroke_fill=stroke[1] if stroke else None)
        rot = math.degrees(mid) - 90 if bottom else math.degrees(mid) + 90
        tile = tile.rotate(-rot, resample=Image.BICUBIC)
        x = C + math.cos(mid) * radius - pad / 2
        y = C + math.sin(mid) * radius - pad / 2
        img.alpha_composite(tile, (int(x), int(y)))
        a = a - step if bottom else a + step


def logo_cut(cover):
    """The cover's logo, cut out along its own navy outline (gold letters, or the dark rim round them, joined to
    the letters), clear of the card frames beside it; its plate's glow is drawn behind it on the disc."""
    box = (60, 120, 760, 440)
    p = cover.crop(box)
    w, h = p.size
    m = Image.new('L', (w + 4, h + 4))
    px, pp = m.load(), p.load()
    for y in range(h):
        for x in range(w):
            r, g, b = pp[x, y]
            if (r > 150 and g > 90 and r > b + 40) or (r < 70 and g < 80 and b < 215):
                px[x + 2, y + 2] = 255
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    ImageDraw.floodfill(m, (300 - box[0] + 2, 200 - box[1] + 2), 200)       # a gold letter: the logo's piece
    m = m.point(lambda v: 255 if v == 200 else 0)
    ImageDraw.floodfill(m, (0, 0), 128)                                       # its holes filled
    m = m.point(lambda v: 0 if v == 128 else 255).crop((2, 2, w + 2, h + 2))
    keep = Image.new('L', (w, h), 0)
    ImageDraw.Draw(keep).polygon([(75, 0), (572, 0), (596, 120), (657, 150), (659, h), (35, h), (35, 150), (90, 120)], fill=255)
    m = ImageChops.multiply(m, keep).filter(ImageFilter.GaussianBlur(.7))
    piece = p.convert('RGBA')
    piece.putalpha(m)
    return piece


def main():
    cover = Image.open(COVER).convert('RGB')
    disc = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    # the foil rim
    disc.paste(holo(S), (0, 0), circle(S, R, .5 * K))
    # the blue face
    face = field(S)
    disc.paste(face, (0, 0), circle(S, FACE, .5 * K))

    # the glowing football and its swirl, from the cover
    ball = feathered(cover, (120, 455, 745, 905), 60, 'ellipse')
    bw = int(345 * K)
    ball = ball.resize((bw, int(ball.height * bw / ball.width)), Image.LANCZOS)
    disc.alpha_composite(ball, (int(C - bw / 2), int(C + 156 * K - ball.height / 2)))

    # the logo, from the cover
    logo = logo_cut(cover)
    lw = int(484 * K)
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    at = (int(C - lw / 2), int(60 * K))
    # the plate behind it: a deep-blue shadow with a cyan rim of light, as on the cover
    a = logo.split()[3]
    plate = Image.new('L', (S, S), 0)
    plate.paste(a.filter(ImageFilter.MaxFilter(9)), at)
    rim = plate.filter(ImageFilter.GaussianBlur(9 * K))
    disc.alpha_composite(Image.merge('RGBA', [Image.new('L', (S, S), v) for v in (120, 220, 255)] + [rim.point(lambda v: int(v * .75))]))
    body = plate.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2 * K))
    disc.alpha_composite(Image.merge('RGBA', [Image.new('L', (S, S), v) for v in (10, 50, 175)] + [body.point(lambda v: int(v * .9))]))
    disc.alpha_composite(logo, at)

    # glints, as on the cover
    for x, y, r in [(150, 318, 26), (560, 455, 30), (190, 520, 13), (548, 300, 11), (118, 420, 9), (505, 560, 8)]:
        sparkle(disc, x * K, y * K, r * K)

    # TRADING CARD GAME along the bottom, as under the cover's logo
    font = ImageFont.truetype(FONT, int(20 * K))
    arc_text(disc, 'TRADING CARD GAME', font, 273 * K, 90, (255, 255, 255, 255),
             stroke=(int(2.4 * K), (10, 40, 140, 255)), spacing=1.22)

    # the gold bevel between face and foil, and a thin silver lip on the edge
    g, gm = gold(S, FACE - 1 * K, FACE + 9 * K)
    disc.paste(g, (0, 0), gm)
    lip = ring(S, R - 3 * K, R, .5 * K)
    disc.paste(Image.new('RGB', (S, S), (235, 240, 250)), (0, 0), lip.point(lambda v: v * .85))

    # the middle: a clear plastic ring round a see-through hole, with a silver hub band
    clear = circle(S, CLEAR, .5 * K)
    tint = Image.new('RGBA', (S, S), (225, 238, 255, 0))
    tint.putalpha(clear.point(lambda v: int(v * .55)))
    under = disc.copy()
    under.putalpha(ImageChops.subtract(under.split()[3], clear))
    disc = Image.alpha_composite(under, tint)
    band = ring(S, CLEAR - 9 * K, CLEAR, .5 * K)
    sil = radial((S, S), [(0, (250, 252, 255)), (.6, (180, 190, 205)), (1, (120, 130, 150))],
                 center=(C - 30 * K, C - 40 * K), radius=CLEAR * 1.6)
    disc.paste(sil, (0, 0), band)
    edge = ring(S, CLEAR - 1.4 * K, CLEAR, .4 * K)
    disc.paste(Image.new('RGB', (S, S), (90, 100, 120)), (0, 0), edge)
    inner = ring(S, HOLE, HOLE + 2 * K, .4 * K)
    disc.paste(Image.new('RGB', (S, S), (200, 215, 235)), (0, 0), inner)
    a = disc.split()[3]
    a = ImageChops.subtract(a, circle(S, HOLE, .4 * K))
    a = ImageChops.multiply(a, circle(S, R, .5 * K))
    disc.putalpha(a)

    out = disc.resize((OUTSIZE, OUTSIZE), Image.LANCZOS)
    out.save(OUT, 'WEBP', quality=88, method=6)
    print('wrote', os.path.relpath(OUT, ROOT), os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
