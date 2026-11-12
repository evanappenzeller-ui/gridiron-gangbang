"""Official NFL headshots for the Rivals cards (Nov 7 2026, Evan: "Use the players official nfl headshots for common and
epic cards").

Rewrites only the headshot fields of data/dynasty.json's players, never ratings or cards: players[key][4] becomes the
player's official NFL.com headshot ('n:<cloudinary id>', or 'n:private/<id>' for NFL's private bucket), from nflverse's
current roster first and its players file second; players[key][8] keeps the ESPN headshot id as the fallback a card
shows if NFL's picture won't load (js/views/dynasty.js headAltUrl). A player NFL has no headshot for keeps his ESPN one.
Legends (keys starting with x) are left alone. Repeatable.

    python3 -I tools/dynasty/nfl_heads.py <cache dir>   # downloads roster_2026.csv and players.csv there if missing
"""
import csv, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'data', 'dynasty.json')
REL = 'https://github.com/nflverse/nflverse-data/releases/download/'
SEASON = 2026
FILES = {'roster': f'rosters/roster_{SEASON}.csv', 'players': 'players/players.csv'}
NFL = re.compile(r'^https://static\.www\.nfl\.com/image/(upload|private)/[^/]*(?:/v\d+)?/league/([A-Za-z0-9_-]+)$')


def nfl_head(url):
    """'n:<id>' (or 'n:private/<id>') for an NFL.com headshot URL, else ''."""
    m = NFL.match(url or '')
    if not m:
        return ''
    return 'n:' + ('private/' if m.group(1) == 'private' else '') + m.group(2)


def rows(cache, k):
    f = os.path.join(cache, os.path.basename(FILES[k]))
    if not os.path.exists(f):
        print('fetch', FILES[k], file=sys.stderr)
        urllib.request.urlretrieve(REL + FILES[k], f)
    with open(f, newline='', encoding='utf-8') as fh:
        return list(csv.DictReader(fh))


def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.cache', 'nflverse')
    os.makedirs(cache, exist_ok=True)
    heads = {}
    for r in rows(cache, 'players'):
        h = nfl_head(r.get('headshot'))
        if h and r.get('gsis_id'):
            heads[r['gsis_id'].replace('00-', '')] = h
    for r in rows(cache, 'roster'):  # (this season's picture wins)
        h = nfl_head(r.get('headshot_url'))
        if h and r.get('gsis_id'):
            heads[r['gsis_id'].replace('00-', '')] = h
    with open(OUT, encoding='utf-8') as f:
        d = json.load(f)
    nfl = espn = 0
    for key, pl in d['players'].items():
        if key.startswith('x'):
            continue
        while len(pl) < 9:
            pl.append('' if len(pl) != 7 else 0)
        cur = pl[4] or ''
        alt = pl[8] or (cur if re.fullmatch(r'\d+', cur) else '')
        h = heads.get(key) or (cur if cur.startswith('n:') else '')
        pl[4], pl[8] = (h, alt) if h else (alt, '')
        nfl += bool(h)
        espn += not h and bool(alt)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{nfl} players on NFL.com headshots, {espn} on ESPN only', file=sys.stderr)


if __name__ == '__main__':
    main()
