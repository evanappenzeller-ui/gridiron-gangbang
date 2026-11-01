"""The Rivals card reverse (Nov 1 2026, Evan: "Use the attached for the back of the cards").

Builds img/rivals/card-back-v1.webp from the owner's picture (tools/dynasty/src/card-back-source.png):
sized to 63:88, its screenshot corners cut away on the card's own rounded outline (transparent).
Give changed output a new version number (sw.js keeps pictures across releases).
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'tools/dynasty/src/card-back-source.png', ROOT / 'img/rivals/card-back-v1.webp'
W, H = 630, 880          # 63:88
SS = 4                   # supersampled mask for a smooth edge

im = Image.open(SRC).convert('RGB').resize((W, H), Image.LANCZOS)
mask = Image.new('L', (W * SS, H * SS), 0)
# matches .pk-flip-back's border-radius: 5% / 3.6%
ImageDraw.Draw(mask).rounded_rectangle((0, 0, W * SS - 1, H * SS - 1), radius=int(.05 * W * SS), fill=255)
im.putalpha(mask.resize((W, H), Image.LANCZOS))
im.save(OUT, 'WEBP', quality=86, method=6)
print(OUT.relative_to(ROOT), OUT.stat().st_size, 'bytes')
