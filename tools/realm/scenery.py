# The Realm's scenery (img/realm/scenery.webp, laid on the ground round the lot by js/views/realm-3d.js): the coastal
# painting (Oct 2026: GOT_Coastal_Scenery_and_Details.zip, 01_Full_Map.png, 1672 x 941), a harbour to the west, a
# village to the north-west, a castle to the north-east and forest all round an empty meadow, where the lot goes.
#   python3 tools/realm/scenery.py <the folder the zip was unpacked into: GOT_Coastal_Scenery>
# The picture goes in as it is (its own size, no crop). Where the lot lies on it is SCENE in realm-3d.js: the
# meadow's middle and how tall the lot's diamond is there (px); the lot is seen steeper than the painting, so it's
# fitted to the meadow's height and there's meadow to spare each side. (The three detail views in the zip are drawn
# apart from the map, not cut from it, so they don't line up with it and aren't used.)
import sys, os
from PIL import Image

SRC = sys.argv[1]
OUT = 'img/realm/scenery.webp'
im = Image.open(os.path.join(SRC, '01_Full_Map.png')).convert('RGB')
im.save(OUT, quality=86, method=6)
print(OUT, im.size, os.path.getsize(OUT), 'bytes')
