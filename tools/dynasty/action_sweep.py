#!/usr/bin/env python3
"""The sweep behind the action photos (the owner, Nov 1 2026: "There are some where the cropped image looks weird or has
other players in it"): where `action_photos.py find` searches Commons by the player's name, this goes through the games
his teams played that a Commons photographer shot (All-Pro Reels shoots every Washington game, Erik Drost the Browns, and
others their teams), and Flickr, where those photographers' originals live. Run it on a machine Commons doesn't throttle
(a cloud session's shared address gets "retry in 10 minutes" from its picture host; the owner's PC is fine):

  python3 tools/dynasty/action_sweep.py plan [key ...]     # each Rare+ player's (or those players') games: the game and camp
                                                           # categories of his teams' seasons -> .cache/action/sweep/plan.json
  python3 tools/dynasty/action_sweep.py names [key ...]    # the files in each of his games whose description names him
                                                           # -> sweep/named/<key>.json (the quick wins)
  python3 tools/dynasty/action_sweep.py sheets [key ...]   # contact sheets of each of his games' thumbnails, numbered, to scan
                                                           # by jersey number -> sweep/games/<game>/sheet-NN.jpg + index.json
  python3 tools/dynasty/action_sweep.py view "<File>" [w]  # the picture at that width with a tenths grid (CROP and SAM_HINT
                                                           # fractions read off it) and its page info -> sweep/view/
  python3 tools/dynasty/action_sweep.py flickr [key ...]   # Flickr's freely licensed photos of each player (FLICKR_API_KEY in
                                                           # the environment) -> sweep/flickr-<key>.json and contact sheets
Then PICK the file (a Commons file name, or 'flickr:<photo id>'), CROP it if the face finder won't frame him, and
`action_photos.py build` (REDO gives him a new version). A Flickr pick is credited with the owner's name, its licence and
its photo page, which the licences require; only CC BY, CC BY-SA, CC0, Public Domain Mark, no-known-restrictions and US
Government photos are offered (--nc adds CC BY-NC and BY-NC-SA, usable in this free league app but not beyond; the ND
licences never, a cut-out being a derivative).
"""
import hashlib, html, io, json, os, re, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
import action_photos as A  # noqa: E402

SWEEP = os.path.join(A.CACHE, 'sweep')
FLICKR = 'https://api.flickr.com/services/rest/'
# Flickr's licence ids -> (name, URL)
LICENCES = {
    4: ('CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'), 5: ('CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/'),
    7: ('No known copyright restrictions', 'https://www.flickr.com/commons/usage/'), 8: ('United States Government Work', 'https://www.usa.gov/government-copyright'),
    9: ('CC0', 'https://creativecommons.org/publicdomain/zero/1.0/'), 10: ('Public Domain Mark', 'https://creativecommons.org/publicdomain/mark/1.0/'),
    1: ('CC BY-NC-SA 2.0', 'https://creativecommons.org/licenses/by-nc-sa/2.0/'), 2: ('CC BY-NC 2.0', 'https://creativecommons.org/licenses/by-nc/2.0/'),
}
FREE = [4, 5, 7, 8, 9, 10]
# Teams a player had before his card's (the data knows only his card's team): key -> [(team name, first season, last season)]
STINTS = {
    '0034768': [('New York Jets', 2025, 2026), ('New England Patriots', 2024, 2024), ('Pittsburgh Steelers', 2018, 2023)],  # Chukwuma Okorafor
    '0034668': [('New York Giants', 2024, 2026), ('Tampa Bay Buccaneers', 2020, 2023), ('Tennessee Titans', 2018, 2019)],  # Aaron Stinnie
    '0029592': [('Green Bay Packers', 2026, 2026), ('Tennessee Titans', 2025, 2025), ('Detroit Lions', 2024, 2024), ('Baltimore Ravens', 2021, 2023),
                ('New York Giants', 2019, 2020), ('Cleveland Browns', 2017, 2018), ('Cincinnati Bengals', 2012, 2016)],  # Kevin Zeitler
    '0033131': [('Cleveland Browns', 2025, 2026), ('San Francisco 49ers', 2024, 2024), ('Houston Texans', 2021, 2023), ('Las Vegas Raiders', 2020, 2020),
                ('Dallas Cowboys', 2016, 2019)],  # Maliek Collins
    '0023459': [('Pittsburgh Steelers', 2025, 2026), ('New York Jets', 2023, 2024), ('Green Bay Packers', 2005, 2022)],  # Aaron Rodgers
    '0036409': [('Miami Dolphins', 2024, 2026), ('Seattle Seahawks', 2020, 2023)],  # Jordyn Brooks
    '0034495': [('Houston Texans', 2025, 2026), ('Arizona Cardinals', 2024, 2024), ('Seattle Seahawks', 2023, 2023), ('Detroit Lions', 2021, 2022),
                ('New York Giants', 2018, 2020)],  # Evan Brown
}
# A franchise's earlier names, for its season categories
FORMER = {'Washington Commanders': [('Washington Football Team', 2020, 2021), ('Washington Redskins', 1937, 2019)],
          'Las Vegas Raiders': [('Oakland Raiders', 1995, 2019)], 'Los Angeles Chargers': [('San Diego Chargers', 1961, 2016)],
          'Los Angeles Rams': [('St. Louis Rams', 1995, 2015)]}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def cat_name(c):
    c = c.strip()
    return (c[9:] if c.startswith('Category:') else c).replace('_', ' ')


def jload(p, default):
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default


def jdump(o, p):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


def season_games(team, year):
    """The game and camp categories of a team's season on Commons (cached)."""
    p = os.path.join(SWEEP, 'seasons', A.slug(f'{year} {team}') + '.json')
    got = jload(p, None)
    if got is not None:
        return got
    h = A.get('https://commons.wikimedia.org/wiki/' + urllib.parse.quote(f'Category:{year}_{team.replace(" ", "_")}_season'))
    s, e = h.find('id="mw-subcategories"'), h.find('id="mw-category-media"')
    subs = [urllib.parse.unquote(c)[9:].replace('_', ' ') for c in dict.fromkeys(re.findall(r'href="/wiki/(Category:[^"#?]+)"', h[s:e] if s >= 0 else ''))]
    games = [c for c in subs if (re.search(r'\(.*\d{4}\)$', c) or re.search(r'camp|minicamp|Game$|Bowl', c)) and 'Uses of' not in c]
    jdump(games, p)
    return games


def stints(key, players, span):
    if key in STINTS:
        return STINTS[key]
    d = players
    team = A.json.load(open(A.DATA, encoding='utf-8'))['teams'][d[key][1]][0]
    first, last = span
    out = [(team, first, last)]
    for name, a, b in FORMER.get(team, []):
        if a <= last and b >= first:
            out.append((name, max(a, first), min(b, last)))
    return out


def plan(keys=()):
    """Each player's games: the game and camp categories of his teams' seasons."""
    club, _ = A.club()
    d = A.json.load(open(A.DATA, encoding='utf-8'))
    out = jload(os.path.join(SWEEP, 'plan.json'), {})
    for key, name, team, pos, college, span in club:
        if keys and key not in keys:
            continue
        games = []
        for t, a, b in stints(key, d['players'], span):
            for y in range(max(a, 2005), min(b, A.SEASON) + 1):
                nick = t.split()[-1]
                games += [g for g in season_games(t, y) if nick in g or f'{y} {t}' in g]
        out[key] = {'name': name, 'team': team, 'pos': pos, 'number': d['players'][key][3], 'span': list(span), 'games': list(dict.fromkeys(games))}
        log(f'{name}: {len(out[key]["games"])} games')
        jdump(out, os.path.join(SWEEP, 'plan.json'))
    return out


def search_files(q, limit=100):
    h = A.get('https://commons.wikimedia.org/w/index.php?' + urllib.parse.urlencode({'search': q, 'ns6': '1', 'fulltext': '1', 'limit': str(limit)}))
    out = []
    for m in re.finditer(r'<li class="mw-search-result.*?</li>', h, re.S):
        b = m.group(0)
        f = re.search(r'href="/wiki/File:([^"]+)"', b); z = re.search(r'([\d,]+) × ([\d,]+)', b)
        if f:
            out.append({'file': urllib.parse.unquote(f.group(1)).replace('_', ' '),
                        'w': int(z.group(1).replace(',', '')) if z else 0, 'h': int(z.group(2).replace(',', '')) if z else 0})
    return out


def names(keys=()):
    """The files in each of a player's games whose description names him."""
    pl = plan(keys)
    for key, o in pl.items():
        if keys and key not in keys:
            continue
        p = os.path.join(SWEEP, 'named', key + '.json')
        got = jload(p, {})
        last = A.plain(o['name']).split()[-1]
        for g in o['games']:
            if g in got:
                continue
            got[g] = search_files(f'incategory:"{g}" "{A.plain(o["name"])}"') or search_files(f'incategory:"{g}" {last}')
            jdump(got, p)
        log(f'{o["name"]}: {sum(len(v) for v in got.values())} named in {len(o["games"])} games')


def cat_files(c):
    """Every file in a category: [{file, w, h, thumb}] (thumb: its 250px picture)."""
    c = cat_name(c)
    p = os.path.join(SWEEP, 'games', A.slug(c), 'files.json')
    got = jload(p, None)
    if got is not None:
        return got
    files, url = [], 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote('Category:' + c.replace(' ', '_'))
    for _ in range(12):
        h = A.get(url)
        if not h:
            break
        a = h.find('id="mw-category-media"')
        for li in re.finditer(r'<li class="gallerybox".*?</li>', h[a:] if a >= 0 else '', re.S):
            b = li.group(0)
            f = re.search(r'href="/wiki/File:([^"]+)"', b)
            t = re.search(r'srcset="(https://[^" ]+/250px-[^" ]+)', b) or re.search(r'src="(https://[^" ]+/120px-[^" ]+)', b)
            w = re.search(r'data-file-width="(\d+)"', b); hh = re.search(r'data-file-height="(\d+)"', b)
            if f and t:
                files.append({'file': urllib.parse.unquote(f.group(1)).replace('_', ' '), 'w': int(w.group(1)) if w else 0,
                              'h': int(hh.group(1)) if hh else 0,
                              'thumb': t.group(1).replace('https://thumb.wikimedia.org', 'https://upload.wikimedia.org').split('?')[0]})
        m = re.search(r'<a href="([^"]+filefrom=[^"]+)"[^>]*>next page', h)
        if not m:
            break
        url = 'https://commons.wikimedia.org' + html.unescape(m.group(1))
    jdump(files, p)
    return files


def game_sheets(c):
    """Contact sheets of a game's thumbnails, numbered (6 x 4 a sheet), and index.json; returns the sheet paths."""
    from PIL import Image, ImageDraw
    c = cat_name(c)
    d = os.path.join(SWEEP, 'games', A.slug(c))
    files = cat_files(c)
    if os.path.exists(os.path.join(d, 'done')):
        return sorted(os.path.join(d, f) for f in os.listdir(d) if f.startswith('sheet-'))
    cols, rows, cw, ch = 6, 4, 260, 290
    out = []
    for n in range(0, len(files), cols * rows):
        sp = os.path.join(d, f'sheet-{n // (cols * rows):02d}.jpg')
        sheet = Image.new('RGB', (cols * cw, rows * ch), 'white'); dr = ImageDraw.Draw(sheet)
        for i, f in enumerate(files[n:n + cols * rows]):
            tp = os.path.join(SWEEP, 'thumbs', hashlib.sha1(f['thumb'].encode()).hexdigest()[:20] + '.jpg')
            os.makedirs(os.path.dirname(tp), exist_ok=True)
            x, y = i % cols * cw, i // cols * ch
            if A.fetch(f['thumb'], tp):
                try:
                    im = Image.open(tp).convert('RGB'); im.thumbnail((cw - 8, 250)); sheet.paste(im, (x + 4, y + 2))
                except Exception:
                    pass
            dr.rectangle([x + 2, y + 254, x + 44, y + 272], fill='black'); dr.text((x + 6, y + 257), str(n + i), fill='yellow')
            dr.text((x + 48, y + 257), f"{f['w']}x{f['h']}", fill='gray'); dr.text((x + 4, y + 274), f['file'][:40], fill='black')
        sheet.save(sp, quality=82)
        out.append(sp)
    jdump({i: f['file'] for i, f in enumerate(files)}, os.path.join(d, 'index.json'))
    open(os.path.join(d, 'done'), 'w').write(str(len(files)))
    return out


def sheets(keys=()):
    pl = plan(keys)
    for key, o in pl.items():
        if keys and key not in keys:
            continue
        for g in o['games']:
            ps = game_sheets(g)
            log(f'{o["name"]}: {g}: {len(ps)} sheets')
            for p in ps:
                print(p)


def view(f, width=800):
    """The picture at width with a tenths grid (x fractions along the top, y down the side), and its page info."""
    from PIL import Image, ImageDraw
    f = f.strip()
    f = (f[5:] if f.startswith('File:') else f).replace(' ', '_')
    i = A.file_info(f) or {'file': f, 'w': 0, 'h': 0}
    width = min(width, i.get('w') or width)
    raw = os.path.join(SWEEP, 'view', f'{A.slug(f)[:80]}-{width}.jpg')
    out = raw[:-4] + '-grid.jpg'
    if not os.path.exists(out):
        os.makedirs(os.path.dirname(raw), exist_ok=True)
        if not A.fetch(A.thumb(f, width), raw):
            return '', i
        im = Image.open(raw).convert('RGB')
        dr = ImageDraw.Draw(im)
        for g in range(1, 10):
            col = (255, 0, 0) if g == 5 else (255, 120, 120)
            dr.line([(im.width * g / 10, 0), (im.width * g / 10, im.height)], fill=col)
            dr.line([(0, im.height * g / 10), (im.width, im.height * g / 10)], fill=col)
            dr.text((im.width * g / 10 + 2, 2), f'.{g}', fill='yellow'); dr.text((2, im.height * g / 10 + 2), f'.{g}', fill='yellow')
        im.save(out, quality=88)
    return out, i


# Flickr

def flickr_call(method, **params):
    key = os.environ.get('FLICKR_API_KEY')
    if not key:
        raise SystemExit('FLICKR_API_KEY is not set (a free key from https://www.flickr.com/services/apps/create/)')
    q = {'method': method, 'api_key': key, 'format': 'json', 'nojsoncallback': '1', **params}
    url = FLICKR + '?' + urllib.parse.urlencode(q)
    # (Flickr drops about half the connections at times: keep asking, and say so when it never answered)
    for n in range(12):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': A.UA}), timeout=60) as r:
                d = json.loads(r.read().decode('utf-8'))
            if d.get('stat') != 'ok':
                raise SystemExit(f'Flickr: {d.get("message", d)}')
            time.sleep(.3)
            return d
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(min(30, 3 * (n + 1)))
    log('  ! flickr never answered', method)
    return {'failed': True}


def flickr_info(pid):
    """A Flickr photo's owner, licence, date, page and largest picture: {owner, author, licence, licenceUrl, year, page, url, w, h}."""
    p = os.path.join(SWEEP, 'flickr', f'info-{pid}.json')
    got = jload(p, None)
    if got:
        return got
    ph = flickr_call('flickr.photos.getInfo', photo_id=pid).get('photo', {})
    sizes = flickr_call('flickr.photos.getSizes', photo_id=pid).get('sizes', {}).get('size', [])
    big = max(sizes, key=lambda s: int(s.get('width', 0)) * int(s.get('height', 0)), default={})
    o = ph.get('owner', {})
    lic = LICENCES.get(int(ph.get('license', 0) or 0), ('', ''))
    page = next((u['_content'] for u in ph.get('urls', {}).get('url', []) if u.get('type') == 'photopage'), '')
    m = re.search(r'(\d{4})', ph.get('dates', {}).get('taken', '') or '')
    got = {'owner': o.get('path_alias') or o.get('nsid', ''), 'author': o.get('realname') or o.get('username', ''), 'licence': lic[0],
           'licenceUrl': lic[1], 'year': int(m.group(1)) if m else 0, 'page': page, 'url': big.get('source', ''),
           'w': int(big.get('width', 0) or 0), 'h': int(big.get('height', 0) or 0), 'title': ph.get('title', {}).get('_content', '')}
    jdump(got, p)
    return got


def flickr(keys=(), nc=False):
    """Each player's freely licensed Flickr photos, on contact sheets to choose from by eye."""
    from PIL import Image, ImageDraw
    club, _ = A.club()
    lic = FREE + ([1, 2] if nc else [])
    for key, name, team, pos, college, span in club:
        if keys and key not in keys:
            continue
        n = A.plain(name)
        found, seen, failed = [], set(), False
        for q in (f'{n} {team.split()[-1]}', f'{n} NFL', f'{n} football'):
            d = flickr_call('flickr.photos.search', text=q, license=','.join(map(str, lic)), sort='relevance', per_page='100', content_type='1',
                            media='photos', extras='license,owner_name,date_taken,url_m,url_l,url_h,url_k,url_o,o_dims')
            failed = failed or d.get('failed', False)
            for ph in d.get('photos', {}).get('photo', []):
                if ph['id'] in seen:
                    continue
                seen.add(ph['id'])
                w = max(int(ph.get(k, 0) or 0) for k in ('width_o', 'width_k', 'width_h', 'width_l'))
                h = max(int(ph.get(k, 0) or 0) for k in ('height_o', 'height_k', 'height_h', 'height_l'))
                yr = re.search(r'(\d{4})', ph.get('datetaken', '') or '')
                yr = int(yr.group(1)) if yr else 0
                if min(w, h) < 700 or (yr and not span[0] - 1 <= yr <= span[1]):
                    continue
                found.append({'id': ph['id'], 'owner': ph.get('owner'), 'author': ph.get('ownername', ''), 'title': ph.get('title', '')[:80],
                              'licence': LICENCES.get(int(ph.get('license', 0) or 0), ('', ''))[0], 'year': yr, 'w': w, 'h': h, 'thumb': ph.get('url_m', '')})
        found = found[:48]
        jdump(found, os.path.join(SWEEP, f'flickr-{key}.json'))
        cols, cw, ch = 6, 260, 300
        rows = max(1, (len(found) + cols - 1) // cols)
        sheet = Image.new('RGB', (cols * cw, rows * ch + 20), 'white'); dr = ImageDraw.Draw(sheet)
        dr.text((4, 4), f'{name} ({key}) on Flickr: {len(found)} freely licensed, in his years, 700 px or more', fill='black')
        for i, ph in enumerate(found):
            x, y = i % cols * cw, 20 + i // cols * ch
            tp = os.path.join(SWEEP, 'flickr', 'thumbs', ph['id'] + '.jpg')
            os.makedirs(os.path.dirname(tp), exist_ok=True)
            if ph['thumb'] and A.fetch(ph['thumb'], tp):
                try:
                    im = Image.open(tp).convert('RGB'); im.thumbnail((cw - 8, 250)); sheet.paste(im, (x + 4, y + 2))
                except Exception:
                    pass
            dr.rectangle([x + 2, y + 254, x + 44, y + 272], fill='black'); dr.text((x + 6, y + 257), str(i), fill='yellow')
            dr.text((x + 48, y + 257), f"{ph['w']}x{ph['h']} {ph['year'] or ''} {ph['licence']}"[:34], fill='gray')
            dr.text((x + 4, y + 274), f"{ph['id']} {ph['author']}"[:40], fill='black')
        sp = os.path.join(SWEEP, f'flickr-{key}.jpg')
        sheet.save(sp, quality=82)
        log(f'{name}: {len(found)} Flickr candidates' + (' (INCOMPLETE: Flickr never answered a search)' if failed else '') + f' -> {sp}')
        print(sp)


if __name__ == '__main__':
    a = sys.argv[1:]
    cmd = a[0] if a else ''
    keys = tuple(x for x in a[1:] if not x.startswith('--'))
    if cmd == 'plan':
        plan(keys)
    elif cmd == 'names':
        names(keys)
    elif cmd == 'sheets':
        sheets(keys)
    elif cmd == 'view':
        p, i = view(a[1], int(a[2]) if len(a) > 2 else 800)
        print(json.dumps({'path': p, **{k: v for k, v in i.items() if k != 'cats'}}, indent=1, ensure_ascii=False))
    elif cmd == 'flickr':
        flickr(keys, nc='--nc' in a)
    else:
        print(__doc__)
