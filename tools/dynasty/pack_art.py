#!/usr/bin/env python3
"""Gridiron Rivals' foil booster packs (v1): the pieces views/dynasty-packs.js lays over its SVG art.

The owner (Oct 31 2026), with four mock-ups of the case's cover turned into foil packs: "Use attached as inspiration
to redesign the packs. These can be used as the standard packs. Make 3 standard packs, the ones that cost more will
have a brighter, more detailed design." The Standard, Team and Premium Packs wear a crinkled holographic foil wrapper
round a framed card, the cover's logo at its head and the cover's football in a swirl of light. Their logo colours
rise with the price: ice blue and orange (Standard), the cover's gold (Team), neon pink and gold (Premium).

    python3 tools/dynasty/pack_art.py   ->  img/rivals/packs/foil-v1.webp, ball-v1.webp, logo-<std|team|prem>-v1.webp

Everything is lifted from the case's cover (img/games/dynasty-cover-v3.webp) or drawn here; no new artwork.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from disc_v4 import COVER, logo_cut  # noqa: E402  (the disc's own cut of the cover's logo)

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'img/rivals/packs')


# ---------------------------------------------------------------------------------------------------- the foil
def noise(rnd, w, h, cells):
    """Smooth value noise: a coarse random grid, blown up bicubically."""
    g = Image.fromarray((rnd.random((cells[1] + 3, cells[0] + 3)) * 255).astype('uint8'), 'L')
    big = g.resize((w + 2 * w // cells[0], h + 2 * h // cells[1]), Image.BICUBIC)
    ox, oy = w // cells[0], h // cells[1]
    return np.asarray(big.crop((ox, oy, ox + w, oy + h))).astype(np.float32) / 255


def foil(w=400, h=640, seed=11):
    """Crinkled holographic foil: a crumpled sheet (ridged noise, its creases sharp, long down the wrapper as a pack
    is creased), shaded by where each bit faces: its hue swings with the tilt, as a real foil wrapper's rainbow does,
    over a slow sweep of colour across the sheet; lit from the upper left, glinting where it faces the light."""
    rnd = np.random.default_rng(seed)
    height = np.zeros((h, w), np.float32)
    for cells, amp in (((5, 6), 1.0), ((10, 13), .55), ((20, 26), .3), ((40, 52), .14)):
        n = noise(rnd, w, h, cells)
        height += (1 - np.abs(n * 2 - 1)) * amp       # ridged: a crease where the noise crosses its middle
    gy, gx = np.gradient(height)
    nx, ny = gx * 28, gy * 28
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    hue = (.5 * (xx / w) + .38 * (yy / h) + .22 * nx + .16 * ny + .12 * noise(rnd, w, h, (3, 4))) % 1.0
    light = np.clip(.52 - .3 * nx - .26 * ny, 0, 1)
    glint = np.clip(light - .8, 0, 1) / .2
    sat = .58 - .35 * glint
    val = .62 + .38 * light
    rgb = hsv2rgb(hue, sat, val) + (glint ** 2)[..., None] * .3
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype('uint8'), 'RGB')
    grain = Image.effect_noise((w, h), 14).filter(ImageFilter.GaussianBlur(.5))
    return ImageChops.overlay(img, Image.merge('RGB', [grain] * 3))


def hsv2rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1)


# ---------------------------------------------------------------------------------------------------- the ball
def ball_cut(cover):
    """The cover's football, cut out: its lit leather's convex hull gives the upper side and the tips, mirrored
    about its long axis for the shaded side (lost in the cover's blue glow)."""
    box = (150, 470, 720, 880)
    piece = cover.crop(box)
    p = np.asarray(piece).astype(int)
    r, g, b = p[..., 0], p[..., 1], p[..., 2]
    leather = (r > b + 45) & (r > g + 12) & (b < 160)
    m = Image.fromarray((leather * 255).astype('uint8')).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    ys, xs = np.nonzero(np.asarray(m) > 0)
    hull = convex_hull(sorted(set(zip(xs.tolist(), ys.tolist()))))
    A, B = max(((a, c) for a in hull for c in hull), key=lambda q: (q[0][0] - q[1][0]) ** 2 + (q[0][1] - q[1][1]) ** 2)
    A, B = sorted((A, B))
    L = math.hypot(B[0] - A[0], B[1] - A[1])
    ux, uy = (B[0] - A[0]) / L, (B[1] - A[1]) / L
    nx, ny = uy, -ux
    prof = {}
    for i in range(len(hull)):
        a, c = hull[i], hull[(i + 1) % len(hull)]
        for s in range(24):
            x, y = a[0] + (c[0] - a[0]) * s / 24, a[1] + (c[1] - a[1]) * s / 24
            t, d = (x - A[0]) * ux + (y - A[1]) * uy, (x - A[0]) * nx + (y - A[1]) * ny
            if d > 0:
                k = round(t / L * 60)
                prof[k] = max(prof.get(k, 0), d)
    ks = sorted(prof)
    at = lambda k, d: (A[0] + ux * k / 60 * L + nx * d, A[1] + uy * k / 60 * L + ny * d)
    lens = Image.new('L', piece.size, 0)
    ImageDraw.Draw(lens).polygon([A] + [at(k, prof[k]) for k in ks] + [B] + [at(k, -prof[k] * .96) for k in reversed(ks)], fill=255)
    out = piece.convert('RGBA')
    out.putalpha(lens.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2)))
    return out.crop(out.getbbox())


def convex_hull(pts):
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for q in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0:
            lo.pop()
        lo.append(q)
    for q in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0:
            up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]


# ---------------------------------------------------------------------------------------------------- the logo
# Each pack's colours for the gold letters (GRIDIRON's dark, mid, light; RIVALS' dark, mid, light) and the rim round
# them (dark, light). The cheaper the pack, the cooler and calmer; Premium the neon of the owner's mock-ups.
LOGO = {
    'std': {'top': ((18, 70, 170), (64, 160, 245), (205, 240, 255)), 'bot': ((150, 50, 8), (245, 128, 30), (255, 214, 120)),
            'rim': ((8, 18, 52), (40, 70, 150))},
    'team': None,  # the cover's own gold
    'prem': {'top': ((150, 20, 120), (255, 80, 190), (255, 210, 245)), 'bot': ((170, 70, 10), (255, 176, 40), (255, 246, 170)),
             'rim': ((40, 8, 70), (120, 50, 200))},
}


def ramp(t, stops):
    """t (0..1 arrays) through three colours."""
    t = np.clip(t, 0, 1)[..., None]
    a, b, c = (np.array(s, np.float32) for s in stops)
    return np.where(t < .5, a + (b - a) * (t / .5), b + (c - b) * ((t - .5) / .5))


def recolour(logo, pal):
    if not pal:
        return logo
    a = np.asarray(logo).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3:]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    Y = (.3 * r + .59 * g + .11 * b) / 255
    gold = np.clip((r - b - 25) / 70, 0, 1)                 # the letters' gold (white highlights stay white)
    navy = np.clip((b - r - 10) / 60, 0, 1) * (1 - gold)    # the rim round them
    h = a.shape[0]
    # GRIDIRON above, RIVALS below: per column, the row between the words with the least gold (the logo arches)
    rows = np.arange(int(h * .3), int(h * .6))
    gap = rows[np.argmin(np.asarray(Image.fromarray((gold * 255).astype('uint8')).filter(ImageFilter.BoxBlur(6))).astype(float)[rows], 0)]
    gap = np.convolve(np.pad(gap.astype(float), 25, mode='edge'), np.ones(51) / 51, 'valid')
    split = np.clip((np.arange(h)[:, None] - gap[None, :]) / 4 + .5, 0, 1)
    t = np.clip((Y - .25) / .7, 0, 1)
    letters = ramp(t, pal['top']) * (1 - split[..., None]) + ramp(t, pal['bot']) * split[..., None]
    rim = ramp(np.clip(Y * 2.2, 0, 1), (pal['rim'][0], pal['rim'][1], tuple(min(255, v + 60) for v in pal['rim'][1])))
    out = rgb * (1 - gold[..., None]) + letters * gold[..., None]
    out = out * (1 - navy[..., None]) + rim * navy[..., None]
    return Image.fromarray(np.concatenate([np.clip(out, 0, 255), alpha], -1).astype('uint8'), 'RGBA')


def largest_piece(img):
    """Only the biggest connected piece of an RGBA image stays (its alpha elsewhere cleared)."""
    a = np.asarray(img.split()[3]) > 40
    h, w = a.shape
    seen = np.zeros_like(a)
    best = None
    for y0, x0 in zip(*np.nonzero(a)):
        if seen[y0, x0]:
            continue
        stack, piece = [(y0, x0)], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            piece.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    stack.append((yy, xx))
        if best is None or len(piece) > len(best):
            best = piece
    keep = np.zeros_like(a)
    ys, xs = zip(*best)
    keep[list(ys), list(xs)] = True
    keep = np.asarray(Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5)))
    out = np.asarray(img).copy()
    out[..., 3] = np.minimum(out[..., 3], keep)
    return Image.fromarray(out, 'RGBA')


def main():
    os.makedirs(OUT, exist_ok=True)
    cover = Image.open(COVER).convert('RGB')
    foil().save(os.path.join(OUT, 'foil-v1.webp'), quality=74, method=6)
    ball = ball_cut(cover)
    ball = ball.resize((360, round(ball.height * 360 / ball.width)), Image.LANCZOS)
    ball.save(os.path.join(OUT, 'ball-v1.webp'), quality=88, method=6)
    logo = logo_cut(cover)
    logo = largest_piece(logo)  # (not the slivers of the cover's card frames at its sides)
    logo = logo.crop(logo.getbbox())
    logo = logo.resize((440, round(logo.height * 440 / logo.width)), Image.LANCZOS)
    for k, pal in LOGO.items():
        recolour(logo, pal).save(os.path.join(OUT, f'logo-{k}-v1.webp'), quality=90, method=6)
    for f in sorted(os.listdir(OUT)):
        im = Image.open(os.path.join(OUT, f))
        print(f, im.size, os.path.getsize(os.path.join(OUT, f)), 'bytes')


if __name__ == '__main__':
    main()
