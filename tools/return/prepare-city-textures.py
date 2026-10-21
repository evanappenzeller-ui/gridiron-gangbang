"""Resize and encode the approved City bus PNG masters for the mobile app.

Usage: python tools/return/prepare-city-textures.py <directory-with-city-bus-PNGs>
Requires Pillow. Original artwork remains unchanged in the source directory.
"""
from pathlib import Path
import argparse
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
args = parser.parse_args()
destination = Path(__file__).resolve().parents[2] / "img" / "return" / "city"
destination.mkdir(parents=True, exist_ok=True)
for face in ("rear", "side", "roof"):
    source = args.source / f"city-bus-{face}.png"
    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        target = destination / f"bus-{face}-v1.webp"
        image.save(target, "WEBP", quality=88, method=6)
        print(f"{target.name}: {image.width}x{image.height}, {target.stat().st_size} bytes")
