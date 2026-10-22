"""Package versioned generated Realm art and its calibrated square build plots.

Run with --package-art to convert the original PNGs named in world-art-prompts.json
to WebP without resizing or repainting. Normal runs rebuild only layout metadata.
The original images are retained. New artwork is loaded only for the owner.
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageStat

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'img' / 'realm' / 'scenery'
LOTS = {
    'coast': (452, 807, 140),
    'forest': (441, 855, 128),
    'tundra': (450, 876, 170),
    'ocean': (443, 886, 134),
    'desert': (444, 890, 126),
    'infernal': (440, 892, 150),
    'christmas': (442, 872, 132),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package-art', action='store_true')
    parser.add_argument('--theme', help='Package only one scenery')
    args = parser.parse_args()
    manifest = json.loads((HERE / 'world-art-prompts.json').read_text(encoding='utf-8'))
    holiday = json.loads((HERE / 'holiday-art-prompts.json').read_text(encoding='utf-8'))
    entries = [dict(entry, **holiday.get(entry['theme'], {})) for entry in manifest['images']]
    entries.append(dict(holiday['christmas'], theme='christmas'))
    for entry in entries:
        theme = entry['theme']
        if args.theme and args.theme != theme:
            continue
        target = OUT / entry['asset']
        if args.package_art:
            target.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(entry['source']) as source:
                source.convert('RGB').save(target, 'WEBP', quality=92, method=6)
        with Image.open(target) as art:
            width, height = art.size
            cx, cy, h = LOTS[theme]
            mean = ImageStat.Stat(art.convert('RGB').crop((cx - 16, cy - 16, cx + 16, cy + 16))).mean
            terrain = '#' + ''.join(f'{round(c):02x}' for c in mean)
        hh, hw = h * .54, h * .54 / math.sin(.9)
        aid = theme + ':world-v2'
        layout = {
            'schema_version': 1,
            'scene': {'width': width, 'height': height, 'origin': 'top-left', 'units': 'reference pixels', 'background_asset_id': aid},
            'lot': {'cx': cx, 'cy': cy, 'h': h},
            'terrain_color': terrain,
            'lighting': entry.get('lighting', 'day'),
            'build_zone_polygon': [[cx - hw, cy], [cx, cy - hh], [cx + hw, cy], [cx, cy + hh]],
            'assets': {aid: {'width': width, 'height': height, 'pic': {'file': entry['asset'], 'w': width, 'h': height}}},
            'instances': [],
            'notes': 'Architecture and vegetation are baked into the world art. The calibrated lot maps to the unchanged 44 by 44 tile square. Wildlife is rendered separately.'
        }
        if theme == 'christmas':
            santa = holiday['santa']
            sprite_path = OUT / santa['asset']
            if args.package_art:
                with Image.open(santa['source']) as sprite:
                    sprite.convert('RGBA').save(sprite_path, 'WEBP', quality=94, method=6, exact=True)
            with Image.open(sprite_path) as sprite:
                sw, sh = sprite.size
            layout['assets']['christmas:sleigh'] = {'width': sw, 'height': sh, 'pic': {'file': santa['asset'], 'w': sw, 'h': sh}}
        (OUT / entry.get('layout', f'world-{theme}-v2.json')).write_text(json.dumps(layout, indent=2) + '\n', encoding='utf-8')
        print(f'{theme}: {width}x{height}, lot {cx},{cy}/{h}, {terrain}, {target.stat().st_size // 1024} KiB')


if __name__ == '__main__':
    main()
