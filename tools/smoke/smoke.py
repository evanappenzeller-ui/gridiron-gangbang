"""The smoke behind the Daily Games shelf (css/views/puzzles.css, .gm-smoke): img/games/smoke.webp, a tile of soft
drifting haze that repeats seamlessly both ways (the screen slides two layers of it slowly across).

Spectral noise (random phases under a 1/f^beta falloff, so it wraps at the edges by construction), warped by two
more such fields for the wisps, then shaped into smoke: light teal, its density in the alpha. Deterministic (SEED).
Run: python3 tools/smoke/smoke.py  (numpy, Pillow)"""
import os
import numpy as np
from PIL import Image

N, SEED = 512, 7
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'img', 'games', 'smoke.webp')
rng = np.random.default_rng(SEED)


def field(beta, lo=1.0, hi=60.0):
    """A periodic N x N noise field, zero mean, unit spread: power falls as 1/f^beta (no frequencies below lo, and
    soft above hi: smoke has no grain)."""
    fx = np.fft.fftfreq(N)[:, None] * N
    fy = np.fft.fftfreq(N)[None, :] * N
    f = np.sqrt(fx ** 2 + fy ** 2)
    amp = np.where(f >= lo, np.maximum(f, 1) ** (-beta / 2), 0.0) * np.exp(-(f / hi) ** 2)
    spec = amp * np.exp(2j * np.pi * rng.random((N, N)))
    n = np.real(np.fft.ifft2(spec))
    return (n - n.mean()) / n.std()


def sample(img, x, y):
    """Bilinear lookup with wrap-around (keeps the tile seamless)."""
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = x - x0; fy = y - y0
    x0 %= N; y0 %= N; x1 = (x0 + 1) % N; y1 = (y0 + 1) % N
    a = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    b = img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    return a * (1 - fy) + b * fy


yy, xx = np.mgrid[0:N, 0:N].astype(float)
base = field(3.4, lo=1, hi=9)      # the big billows
wx, wy = field(3.0, lo=1, hi=8), field(3.0, lo=1, hi=8)
q = sample(base, xx + 60 * wx, yy + 60 * wy)          # warped: long curls
fine = field(3.0, lo=3, hi=22)
s = q + .28 * sample(fine, xx + 45 * wy, yy + 45 * wx)  # finer wisps drawn along them
s = (s - s.min()) / (s.max() - s.min())

lo, hi = .32, 1.0                  # thin out the low half, soft tops
d = np.clip((s - lo) / (hi - lo), 0, 1)
d = d * d * (3 - 2 * d)            # smoothstep
d = d ** 1.5

col = np.array([168, 222, 236], float)                 # light teal: the screen's tint does the rest
rgba = np.zeros((N, N, 4), np.uint8)
rgba[..., :3] = col
rgba[..., 3] = np.round(d * 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(OUT, quality=82, method=6)
print(OUT, os.path.getsize(OUT), 'bytes; mean density', round(float(d.mean()), 3))
