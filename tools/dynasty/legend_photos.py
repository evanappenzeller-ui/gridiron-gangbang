#!/usr/bin/env python3
"""Brings the Legends' photos into Gridiron Rivals (the owner, Oct 31 2026: "Import into game for me to see", after asking
which Legends have Wikimedia photos): each Legend's Wikipedia lead photo, only where Wikipedia marks it freely licensed
(pilicense=free: no fair-use pictures), cropped round his face -> img/dynasty/legends/<file>.jpg (600 x 450), and the
PHOTO table in js/core/dynasty-legends.js (between its <legend-photos> marks) with each photo's author and licence, which
the card's details credit. Run: python3 tools/dynasty/legend_photos.py [--cache DIR] (then bump CACHE in sw.js).
Needs en.wikipedia.org and upload.wikimedia.org; the face crop uses OpenCV 4 (opencv-python-headless<5) when it's there,
otherwise the top-centre of the photo.

TITLE names the article where the plain name is ambiguous; FILE puts a chosen Commons file in place of the article's lead
photo; SKIP leaves a Legend without one (his card keeps his number); CROP sets the crop by hand where the face finder
misses (checked by eye on a contact sheet).
"""
import hashlib, html, json, os, re, ssl, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'data', 'dynasty.json')
IMG = os.path.join(ROOT, 'img', 'dynasty', 'legends')
JS = os.path.join(ROOT, 'js', 'core', 'dynasty-legends.js')
API = 'https://en.wikipedia.org/w/api.php'
UA = 'GridironRivalsLegendPhotos/1.0 (https://github.com/evanappenzeller-ui/gridiron-gangbang)'
W, H = 600, 450

# Legend's name (data/dynasty.json) -> his Wikipedia article, where the name alone is a namesake or a disambiguation page
TITLE = {
    'Dick "Night Train" Lane': 'Night Train Lane', 'Bruce Smith': 'Bruce Smith', 'Joe Thomas': 'Joe Thomas (offensive tackle)',
    'Walter Jones': 'Walter Jones (American football)', 'Tim Brown': 'Tim Brown (American football)',
    'Jim Parker': 'Jim Parker (American football)', 'Willie Brown': 'Willie Brown (American football)',
    'Mike Haynes': 'Mike Haynes (cornerback)', 'Randy White': 'Randy White (American football)',
    'Larry Wilson': 'Larry Wilson (American football)', 'Jack Lambert': 'Jack Lambert (American football)',
    'John Hannah': 'John Hannah (American football)', 'John Mackey': 'John Mackey (American football)',
}
FILE = {}
SKIP = set()
# name -> (centre x, top, height) as fractions of the photo's width and height
CROP = {
    'Bruce Smith': (.45, .08, .6), 'Gale Sayers': (.5, 0, .58), 'Earl Campbell': (.55, .02, .62), 'Eric Dickerson': (.5, .1, .5),
}


CACHE = None  # (main sets it: the API's answers are kept there, so a rerun after a rate limit picks up where it stopped)


def open_url(url):
    """The bytes at url, waiting out Wikimedia's rate limit (429: its Retry-After, else a growing pause)."""
    ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE')) if os.environ.get('SSL_CERT_FILE') else None
    for n in range(12):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), context=ctx, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or n == 11:
                raise
            time.sleep(max(int(e.headers.get('Retry-After') or 0), 5 * (n + 1)) + 2)


def get(params):
    url = API + '?' + urllib.parse.urlencode({'format': 'json', 'formatversion': '2', **params})
    keep = os.path.join(CACHE, 'api-' + hashlib.sha1(url.encode()).hexdigest()[:16] + '.json') if CACHE else ''
    if keep and os.path.exists(keep):
        return json.load(open(keep, encoding='utf-8'))
    d = json.loads(open_url(url))
    if keep:
        json.dump(d, open(keep, 'w', encoding='utf-8'))
    time.sleep(1)
    return d


def fetch(urls, path):
    """Downloads the first of urls that answers (a thumbnail, then the same on upload.wikimedia.org, then the original)."""
    if os.path.exists(path):
        return
    err = None
    for url in dict.fromkeys(u for u in urls if u):
        try:
            data = open_url(url)
        except (urllib.error.HTTPError, urllib.error.URLError) as e:
            err = e
            continue
        with open(path, 'wb') as f:
            f.write(data)
        time.sleep(1)
        return
    raise err


def plain(s):
    """An author's name as text (the API gives HTML: links, spans, line breaks)."""
    s = re.sub(r'<[^>]+>', ' ', s or '')
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def slug(key):
    return unicodedata.normalize('NFKD', key).encode('ascii', 'ignore').decode()


def faces(img):
    """The faces OpenCV finds, largest first ([] without OpenCV 4)."""
    try:
        import cv2, numpy as np
    except ImportError:
        return []
    cas = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
    if not os.path.exists(cas):
        return []
    g = cv2.cvtColor(np.array(img.convert('RGB')), cv2.COLOR_RGB2GRAY)
    side = min(g.shape)
    found = cv2.CascadeClassifier(cas).detectMultiScale(g, scaleFactor=1.08, minNeighbors=6, minSize=(max(24, side // 14),) * 2)
    return sorted((tuple(int(v) for v in f) for f in found), key=lambda f: -f[2] * f[3])


def crop(src, out, hand=None):
    """A 4:3 head-and-shoulders crop (hand's, else round the largest face, else the photo's top centre), saved as a
    600 x 450 JPEG."""
    from PIL import Image, ImageOps
    img = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    iw, ih = img.size
    f = [] if hand else faces(img)
    if hand:
        ch = min(ih, hand[2] * ih); cw = ch * W / H
        if cw > iw:
            cw = iw; ch = cw * H / W
        left, top = hand[0] * iw - cw / 2, hand[1] * ih
    elif f:
        x, y, w, h = f[0]
        ch = min(ih, max(h * 3.4, ih * .3))
        cw = ch * W / H
        if cw > iw:
            cw = iw; ch = cw * H / W
        cx, cy = x + w / 2, y + h / 2
        left, top = cx - cw / 2, cy - ch * .4
    else:
        cw = iw; ch = cw * H / W
        if ch > ih:
            ch = ih; cw = ch * W / H
        left, top = (iw - cw) / 2, min(ih * .04, ih - ch)
    left = max(0, min(left, iw - cw)); top = max(0, min(top, ih - ch))
    img.crop((round(left), round(top), round(left + cw), round(top + ch))).resize((W, H), Image.LANCZOS) \
        .save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    return bool(f)


def main():
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else os.path.join(ROOT, 'tools', 'dynasty', '.cache', 'legends')
    global CACHE
    CACHE = cache
    os.makedirs(cache, exist_ok=True); os.makedirs(IMG, exist_ok=True)
    players = json.load(open(DATA, encoding='utf-8'))['players']
    legends = [(k, v[0]) for k, v in players.items() if k.startswith('x') and v[0] not in SKIP]
    # each Legend's article and its lead photo (free licences only)
    lead = {}
    want = {name: TITLE.get(name, name) for _, name in legends}
    titles = sorted(set(want.values()))
    for i in range(0, len(titles), 45):
        d = get({'action': 'query', 'redirects': '1', 'prop': 'pageimages|pageprops', 'piprop': 'name', 'pilicense': 'free',
                 'ppprop': 'disambiguation', 'titles': '|'.join(titles[i:i + 45])})['query']
        moved = {n['from']: n['to'] for n in d.get('normalized', []) + d.get('redirects', [])}
        pages = {p['title']: p for p in d['pages']}
        for t in titles[i:i + 45]:
            tt = t
            while tt in moved:
                tt = moved[tt]
            p = pages.get(tt, {})
            if p.get('pageimage') and 'disambiguation' not in p.get('pageprops', {}):
                lead[t] = p['pageimage']
    files = {}
    for key, name in legends:
        f = FILE.get(name) or lead.get(want[name])
        if f:
            files[key] = f.replace(' ', '_')
    # each file's picture and credit
    info = {}
    names = sorted(set(files.values()))
    for i in range(0, len(names), 40):
        d = get({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': '960',
                 'iiextmetadatafilter': 'Artist|LicenseShortName|LicenseUrl|Credit',
                 'titles': '|'.join('File:' + n for n in names[i:i + 40])})['query']
        back = {n['to']: n['from'] for n in d.get('normalized', [])}
        for p in d['pages']:
            ii = (p.get('imageinfo') or [{}])[0]
            m = ii.get('extmetadata', {})
            n = back.get(p['title'], p['title'])[5:].replace(' ', '_')
            thumb = ii.get('thumburl') or ''
            info[n] = {'urls': [thumb, re.sub(r'^https://[^/]+/', 'https://upload.wikimedia.org/', thumb) if thumb else '', ii.get('url')], 'url': thumb or ii.get('url'), 'artist': plain(m.get('Artist', {}).get('value')) or 'Unknown author',
                       'lic': plain(m.get('LicenseShortName', {}).get('value')) or 'See file page', 'licUrl': m.get('LicenseUrl', {}).get('value', '')}
    rows, found = [], 0
    for key, name in legends:
        f = files.get(key)
        if not f or not info.get(f, {}).get('url'):
            print('no photo:', name, file=sys.stderr)
            continue
        i = info[f]
        ext = os.path.splitext(urllib.parse.urlparse(i['url']).path)[1].lower() or '.jpg'
        raw = os.path.join(cache, slug(key) + ext)
        fetch(i['urls'], raw)
        found += crop(raw, os.path.join(IMG, slug(key) + '.jpg'), CROP.get(name))
        rows.append(f"  {json.dumps(key, ensure_ascii=False)}: {json.dumps([slug(key), f, i['artist'][:120], i['lic'], i['licUrl']], ensure_ascii=False)}, // {name}")
    keep = {slug(k) + '.jpg' for k in files}
    for old in os.listdir(IMG):
        if old not in keep:
            os.remove(os.path.join(IMG, old))
    js = open(JS, encoding='utf-8').read()
    a, b = js.index('// <legend-photos>'), js.index('// </legend-photos>')
    js = js[:a] + '// <legend-photos> (written by tools/dynasty/legend_photos.py)\nexport const PHOTO = {\n' + '\n'.join(rows) + '\n};\n' + js[b:]
    open(JS, 'w', encoding='utf-8').write(js)
    print(f'{len(rows)} of {len(legends)} Legends have a photo; {found} cropped round a face, {len(CROP)} by hand', file=sys.stderr)


if __name__ == '__main__':
    main()
