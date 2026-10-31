#!/usr/bin/env python3
"""Playing-days photos on the 90+ cards (the owner, Oct 31 2026: "The pictures being used for the legend players are too
formal ... for any players that are in the 90+ overall club. Find photos of them playing or some sort of playing card
design"): a freely licensed Wikimedia Commons photo of each such player in uniform, from his playing days (a game, a Pro
Bowl, a practice, a period trading card or team handout), on every card of his rated 90 or more, in place of the
Legends' Wikipedia lead photos (core/dynasty-legends.js, often a suit at an awards night) and the Live headshots.

  python3 tools/dynasty/action_photos.py find   # every 90+ player's candidates -> .cache/action/candidates.json and
                                                # contact sheets (sheet-NN.jpg) to choose from by eye
  python3 tools/dynasty/action_photos.py build  # PICK -> img/dynasty/action/<key>.jpg (600 x 450) and the ACTION table
                                                # in js/core/dynasty-action.js (between its <action-photos> marks)
Then bump CACHE in sw.js.

Reads Commons' and Wikipedia's ordinary pages (not the API, which rate-limits shared addresses) and the thumbnails on
upload.wikimedia.org. PICK is chosen by eye from the contact sheets: a photo is only picked when it is our player, in
uniform (or on his period card), and he is clear in the crop; CROP sets the crop by hand where the face finder misses.
A player without a pick keeps his portrait (a Legend's lead photo, else his number; a Live player's headshot).
"""
import hashlib, html, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from legend_photos import TITLE, faces, slug, plain  # noqa: E402

sys.dont_write_bytecode = True
DATA = os.path.join(ROOT, 'data', 'dynasty.json')
IMG = os.path.join(ROOT, 'img', 'dynasty', 'action')
JS = os.path.join(ROOT, 'js', 'core', 'dynasty-action.js')
CACHE = os.path.join(ROOT, 'tools', 'dynasty', '.cache', 'action')
UA = 'GridironRivalsActionPhotos/1.0 (https://github.com/evanappenzeller-ui/gridiron-gangbang)'
CLUB = 90       # the 90+ club: a card rated this or more
W, H = 600, 660  # the card's picture window (a little taller than wide)
SEASON = 2026   # this season (a Live player's first season: SEASON - his years in the league)

# player key -> the Commons file chosen by eye (its name as the file page has it, without "File:")
PICK = {}
# player key -> (centre x, top, height) as fractions of the photo's width and height
CROP = {}

POS = {'QB': ['quarterback'], 'RB': ['running back'], 'WR': ['wide receiver'], 'TE': ['tight end'], 'K': ['placekicker', 'kicker'],
       'OL': ['offensive lineman', 'offensive tackle', 'guard', 'center'], 'DL': ['defensive end', 'defensive tackle', 'defensive lineman'],
       'LB': ['linebacker'], 'CB': ['cornerback'], 'S': ['safety']}
GOOD = r'\bvs\.?\b|\bv\.? |versus|\bgame\b|\bweek ?\d|pro bowl|super bowl|training camp|practice|minicamp|preseason|season|playoff|' \
       r'touchdown|rush|pass|tackle|sack|kick|catch|warm|sideline|helmet|uniform|jersey|topps|bowman|fleer|\bcard\b|kahn|jeno|' \
       r'program|media guide|stadium|field'
BAD = r'hall of fame|\bhof\b|enshrine|induct|white house|obama|trump|biden|bush|clinton|reagan|president|award|espys|premiere|' \
      r'red carpet|signing|autograph|\bvisit|rally|gala|ceremony|statue|mural|bust\b|grave|funeral|wedding|laureus|derby|' \
      r'celebrity|golf|senate|congress|campaign|convention|interview|broadcast|studio|podcast|book|festival|concert|' \
      r'charity|fundrais|military|troops|base\b|navy|army|air force|marine|uso\b|signature|logo|tour\b|\bstore\b'
COLLEGE_BOWLS = r'rose bowl|sugar bowl|orange bowl|fiesta bowl|cotton bowl|peach bowl|citrus bowl|ncaa|college|university|heisman'


def get(url):
    """A page's text (cached), waiting out a rate limit."""
    os.makedirs(CACHE, exist_ok=True)
    keep = os.path.join(CACHE, 'p-' + hashlib.sha1(url.encode()).hexdigest()[:20] + '.html')
    if os.path.exists(keep):
        return open(keep, encoding='utf-8').read()
    for n in range(10):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                t = r.read().decode('utf-8', 'replace')
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                t = ''
                break
            if e.code != 429 or n == 9:
                raise
        except (urllib.error.URLError, TimeoutError):
            if n == 9:
                raise
        time.sleep(10 * (n + 1))
    open(keep, 'w', encoding='utf-8').write(t)
    time.sleep(.5)
    return t


def fetch(url, path):
    if os.path.exists(path):
        return True
    for n in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                data = r.read()
            open(path, 'wb').write(data)
            time.sleep(.5)
            return True
        except urllib.error.HTTPError as e:
            if e.code != 429:
                print('  !', e.code, url, file=sys.stderr)
                return False
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(10 * (n + 1))
    return False


def thumb(name, width):
    """A Commons file's thumbnail on upload.wikimedia.org (name with underscores)."""
    h = hashlib.md5(name.encode()).hexdigest()
    q = urllib.parse.quote(name)
    ext = '.jpg' if name.lower().endswith(('.tif', '.tiff')) else ''
    return f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{width}px-{q}{ext}'


def text(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def years(s):
    return [int(y) for y in re.findall(r'(?<!\d)(1[89]\d\d|20[0-3]\d)(?!\d)', s or '')]


def club():
    """The 90+ players: [(key, name, team name, pos, college, (first season, last season))]."""
    d = json.load(open(DATA, encoding='utf-8'))
    best, span = {}, {}
    for c in d['cards']:
        if c[3] >= CLUB:
            best[c[2]] = max(best.get(c[2], 0), c[3])
            if c[1] == 'X' and c[5]:
                y = years(re.sub(r'[–-](\d\d)\b', lambda m: '–' + c[5][0][:2] + m.group(1), c[5][0]))
                if y:
                    span[c[2]] = (min(y), max(y))
    out = []
    for k in sorted(best, key=lambda k: (not k.startswith('x'), -best[k], k)):
        pl = d['players'][k]
        sp = span.get(k) or (SEASON - (pl[5] or 0), SEASON)
        out.append((k, pl[0], d['teams'].get(pl[1], [pl[1]])[0], pl[2], pl[6] or '', sp))
    return out, d['teams']


def article(name, pos, college, legend):
    """His Wikipedia article's HTML ('' if not found)."""
    plain_name = re.sub(r'\s+', ' ', re.sub(r'"[^"]*"', '', name)).strip()
    tries = [TITLE[name]] if name in TITLE else []
    tries += [f'{plain_name} ({p})' for p in POS.get(pos, [])] + [f'{plain_name} (American football)', plain_name]
    for t in tries:
        h = get('https://en.wikipedia.org/wiki/' + urllib.parse.quote(t.replace(' ', '_')))
        if not h or 'may refer to' in h[:200000] and 'disambig' in h:
            continue
        if 'National Football League' in h and (legend or not college or college.split()[0] in h):
            return h
    return ''


def files_of(cat, depth, skip):
    """The files in a Commons category and (to depth) its subcategories."""
    h = get('https://commons.wikimedia.org/wiki/' + urllib.parse.quote(cat.replace(' ', '_')))
    if not h:
        return []
    a = h.find('id="mw-category-media"')
    found = [urllib.parse.unquote(f) for f in re.findall(r'href="/wiki/(File:[^"#?]+)"', h[a:] if a >= 0 else '')]
    if depth:
        s, e = h.find('id="mw-subcategories"'), h.find('id="mw-category-media"')
        for sub in dict.fromkeys(re.findall(r'href="/wiki/(Category:[^"#?]+)"', h[s:e] if s >= 0 else '')):
            sub = urllib.parse.unquote(sub)
            if not re.search(skip, sub, re.I):
                found += files_of(sub, depth - 1, skip)
    return list(dict.fromkeys(f[5:] for f in found))


def file_info(name):
    """A Commons file's credit and description, from its page."""
    h = get('https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(name.replace(' ', '_')))
    if not h:
        return None
    h = h.replace('&#95;', '_')

    def row(i):
        m = re.search(r'id="' + i + r'"[^>]*>.*?</td>\s*<td[^>]*>(.*?)</td>', h, re.S)
        return m.group(1) if m else ''
    date = row('fileinfotpl_date')
    m = re.search(r'datetime="(\d{4})', date)
    lic = re.search(r'class="licensetpl_short[^"]*"[^>]*>(.*?)</span>', h, re.S)
    link = re.search(r'class="licensetpl_link[^"]*"[^>]*>(.*?)</span>', h, re.S)
    size = re.search(r'([\d,]+) × ([\d,]+) pixels', h)
    cats = re.search(r'id="mw-normal-catlinks".*?</div>', h, re.S)
    return {'file': name.replace(' ', '_'), 'year': int(m.group(1)) if m else (years(text(date)) or [None])[0],
            'author': text(row('fileinfotpl_aut'))[:120] or 'Unknown author', 'licence': text(lic.group(1)) if lic else '',
            'licenceUrl': text(link.group(1)) if link else '', 'desc': text(row('fileinfotpl_desc'))[:300],
            'cats': text(cats.group(0)) if cats else '', 'w': int(size.group(1).replace(',', '')) if size else 0,
            'h': int(size.group(2).replace(',', '')) if size else 0}


def score(f, info, name, team, college, span, nick, searched=False):
    last = re.sub(r'\s+(Jr\.|Sr\.|III|II)$', '', re.sub(r'"[^"]*"', '', name)).split()[-1].lower()
    blob = ' '.join([f, (info or {}).get('desc', ''), (info or {}).get('cats', '')]).replace('_', ' ')
    s, why = 0, []
    if last not in blob.lower() and (info or not searched):
        s -= 4; why.append('name?')
    if 'cropped' in f.lower():
        s += 2; why.append('cropped')
    if re.search(GOOD, blob, re.I):
        s += 2; why.append('play')
    if re.search(BAD, blob, re.I):
        s -= 3; why.append('event')
    if re.search(COLLEGE_BOWLS, blob, re.I) or (college and len(college) > 3 and college.lower() in blob.lower()):
        s -= 2; why.append('college')
    if re.search(nick, blob, re.I):
        s += 2; why.append('team')
    if re.search(r'\.(svg|pdf|ogg|ogv|webm|tif|tiff|gif|mp3|wav)$', f, re.I):
        s -= 20
    if info:
        y = info['year']
        if y and span[0] - 1 <= y <= span[1]:
            s += 3; why.append(f'{y} in career')
        elif y and y > span[1]:
            s -= 4; why.append(f'{y} after')
        elif y and y < span[0] - 1:
            s -= 3; why.append(f'{y} before')
        if info['w'] and min(info['w'], info['h']) < 400:
            s -= 2; why.append('small')
    return s, why


def find():
    players, teams = club()
    nick = '|'.join(re.escape(v[0].split()[-1]) for v in teams.values()) + r'|Oilers|Redskins|Colts|Rams|Raiders|Chargers|Cardinals|Patriots|Football Team'
    out = []
    # (find 2/4: the second quarter of the club, so four can run at once; find <key> ...: just those players)
    part = re.fullmatch(r'(\d+)/(\d+)', sys.argv[2]) if len(sys.argv) > 2 else None
    only = set() if part else set(sys.argv[2:])
    name_of = 'candidates-%s-%s.json' % part.groups() if part else 'candidates-some.json' if only else 'candidates.json'
    for n, (key, name, team, pos, college, span) in enumerate(players):
        if only and key not in only or part and n % int(part.group(2)) != int(part.group(1)) - 1:
            continue
        legend = key.startswith('x')
        h = article(name, pos, college, legend)
        cats = [urllib.parse.unquote(c) for c in re.findall(r'commons\.wikimedia\.org/wiki/(Category:[^"#?&]+)', h)]
        plain_name = re.sub(r'\s+', ' ', re.sub(r'"[^"]*"', '', name)).strip()
        canon = re.search(r'<link rel="canonical" href="[^"]*/wiki/([^"#?]+)"', h)
        if not cats:
            cats = ['Category:' + urllib.parse.unquote(canon.group(1)).replace('_', ' ')] if canon else []
            cats += ['Category:' + plain_name]
        skip = r'college|university|high school|family|signature|statue|grave|' + (re.escape(college) if college else 'zzz')
        files = []
        for c in dict.fromkeys(cats[:2]):
            files += files_of(c, 1, skip)
        # the article's own pictures (its infobox and body), where Commons has no category for him
        files += [urllib.parse.unquote(f)[5:] for f in re.findall(r'href="/wiki/(File:[^"#?]+)"', h)]
        # Commons' search (it reads the descriptions too: a game's photos are often numbered, the players named inside)
        found = []
        for q in (f'"{plain_name}" {team.split()[-1]}', f'"{plain_name}" football'):
            r = get('https://commons.wikimedia.org/w/index.php?' + urllib.parse.urlencode({'search': q, 'ns6': '1', 'fulltext': '1', 'limit': '40'}))
            found += [urllib.parse.unquote(f)[5:].replace(' ', '_') for f in re.findall(r'href="/wiki/(File:[^"#?]+)"', r)]
        searched = set(found)
        files += found
        files = [f for f in dict.fromkeys(f.replace(' ', '_') for f in files)
                 if not re.search(r'\.(svg|pdf|ogg|ogv|webm|mp3|wav)$', f, re.I) and not re.search(r'logo|wordmark|icon|flag|map', f, re.I)]
        ranked = sorted(files, key=lambda f: -score(f, None, name, team, college, span, nick, f in searched)[0] - (f in searched))[:16]
        cands = []
        for f in ranked:
            i = file_info(f)
            if not i:
                continue
            s, why = score(f, i, name, team, college, span, nick)
            cands.append({**i, 'score': s, 'why': why})
        cands.sort(key=lambda c: -c['score'])
        out.append({'key': key, 'name': name, 'team': team, 'pos': pos, 'span': span, 'files': len(files), 'cands': cands[:6]})
        print(f'{name}: {len(files)} files, best {cands[0]["score"] if cands else "-"} {cands[0]["file"] if cands else ""}', file=sys.stderr)
        json.dump(out, open(os.path.join(CACHE, name_of), 'w'), indent=1)
    if not part:
        sheets(out)


def sheets(out):
    """Contact sheets: each player's best candidates in a row, numbered as candidates.json lists them."""
    from PIL import Image, ImageDraw
    th = os.path.join(CACHE, 'thumbs')
    os.makedirs(th, exist_ok=True)
    rows = []
    for p in out:
        imgs = []
        for i, c in enumerate(p['cands'][:5]):
            path = os.path.join(th, hashlib.sha1(c['file'].encode()).hexdigest()[:16] + '.jpg')
            w = 330 if not c['w'] or c['w'] > 330 else c['w']
            ok = fetch(thumb(c['file'], w), path) if w < (c['w'] or 9999) else fetch(
                'https://upload.wikimedia.org/wikipedia/commons/' + '/'.join([hashlib.md5(c['file'].encode()).hexdigest()[:1], hashlib.md5(c['file'].encode()).hexdigest()[:2], urllib.parse.quote(c['file'])]), path)
            try:
                im = Image.open(path).convert('RGB') if ok else None
            except Exception:
                im = None
            imgs.append((i, c, im))
        rows.append((p, imgs))
    for n in range(0, len(rows), 8):
        sheet = Image.new('RGB', (1500, 8 * 250), 'white')
        d = ImageDraw.Draw(sheet)
        for r, (p, imgs) in enumerate(rows[n:n + 8]):
            y = r * 250
            d.text((6, y + 4), f'{p["key"]}  {p["name"]}  {p["pos"]} {p["team"]}  {p["span"][0]}-{p["span"][1]}', fill='black')
            x = 6
            for i, c, im in imgs:
                if im:
                    im.thumbnail((280, 210))
                    sheet.paste(im, (x, y + 18))
                d.text((x, y + 230), f'{i}: {c.get("year")} s{c["score"]} {c["file"][:38]}', fill='black')
                x += 296
        sheet.save(os.path.join(CACHE, f'sheet-{n // 8:02d}.jpg'), quality=80)


def crop(src, out, hand=None):
    """A W x H crop of the player in action (hand's, else round the largest face with his shoulders and chest below it,
    else the photo's upper middle), saved as a JPEG."""
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
        ch = min(ih, max(h * 5, ih * .45)); cw = ch * W / H
        if cw > iw:
            cw = iw; ch = cw * H / W
        left, top = x + w / 2 - cw / 2, y + h / 2 - ch * .3
    else:
        ch = ih; cw = ch * W / H
        if cw > iw:
            cw = iw; ch = cw * H / W
        left, top = (iw - cw) / 2, 0
    left = max(0, min(left, iw - cw)); top = max(0, min(top, ih - ch))
    img.crop((round(left), round(top), round(left + cw), round(top + ch))).resize((W, H), Image.LANCZOS) \
        .save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    return bool(f)


def build():
    os.makedirs(IMG, exist_ok=True)
    players = {k: (name, span) for k, name, _, _, _, span in club()[0]}
    rows = []
    for key, f in PICK.items():
        if key not in players:
            print('not in the 90+ club:', key, file=sys.stderr)
            continue
        i = file_info(f.replace(' ', '_'))
        if not i or not i['licence']:
            print('no licence found:', key, f, file=sys.stderr)
            continue
        raw = os.path.join(CACHE, 'raw-' + slug(key) + '.jpg')
        big = i['w'] and i['w'] > 1280
        h = hashlib.md5(i['file'].encode()).hexdigest()
        url = thumb(i['file'], 1280) if big else f'https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{urllib.parse.quote(i["file"])}'
        if not fetch(url, raw):
            continue
        crop(raw, os.path.join(IMG, slug(key) + '.jpg'), CROP.get(key))
        rows.append(f"  {json.dumps(key)}: {json.dumps([slug(key), i['file'], plain(i['author'])[:120], i['licence'], i['licenceUrl'], i['year'] or 0], ensure_ascii=False)}, // {players[key][0]}")
    keep = {slug(k) + '.jpg' for k in PICK}
    for old in os.listdir(IMG):
        if old not in keep:
            os.remove(os.path.join(IMG, old))
    js = open(JS, encoding='utf-8').read()
    a, b = js.index('// <action-photos>'), js.index('// </action-photos>')
    js = js[:a] + '// <action-photos> (written by tools/dynasty/action_photos.py)\nexport const ACTION = {\n' + '\n'.join(rows) + '\n};\n' + js[b:]
    open(JS, 'w', encoding='utf-8').write(js)
    print(f'{len(rows)} of {len(players)} players in the 90+ club have a playing-days photo', file=sys.stderr)


def merge():
    """The parts' candidates in the club's order -> candidates.json and the contact sheets."""
    order = [p[0] for p in club()[0]]
    got = {}
    for f in os.listdir(CACHE):
        if re.fullmatch(r'candidates-\d+-\d+\.json', f):
            got.update({p['key']: p for p in json.load(open(os.path.join(CACHE, f)))})
    out = [got[k] for k in order if k in got]
    json.dump(out, open(os.path.join(CACHE, 'candidates.json'), 'w'), indent=1)
    sheets(out)


if __name__ == '__main__':
    {'find': find, 'merge': merge, 'build': build}[sys.argv[1] if len(sys.argv) > 1 else 'find']()
