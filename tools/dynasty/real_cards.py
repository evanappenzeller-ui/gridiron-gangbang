#!/usr/bin/env python3
"""Brings real trading-card pictures into Gridiron Dynasty (the owner, Oct 29 2026: "i got a playing card api. add the
pictures to gridiron rivals"): the folder his CardSight AI downloader writes (nfl_cards: cards.csv and a folder of JPEGs
per player) -> img/dynasty/real/<player key>-<card id's first 8>.jpg and the REAL table in js/views/dynasty-real.js
(between its <real-cards> marks). Run: python3 tools/dynasty/real_cards.py <the nfl_cards folder> (then bump CACHE in
sw.js). The downloader adds to cards.csv on every run, so rerunning this after more downloads brings in the new ones.

A name goes to the Dynasty player of that name (C.J. and CJ the same); where two share it (Justin Jefferson, the Vikings'
receiver and a Browns linebacker) to the one with the higher-rated card, the star the downloader searched for. Each
player's cards are listed newest base card first (the one his Dynasty card shows), then his inserts newest first; FIRST
puts a chosen card in front instead. A player with more than one Dynasty card shows the next on each (dynasty-real.js).

The downloader's list (the owner, Oct 29 2026, so his free calls go to the best cards first): python3
tools/dynasty/real_cards.py --players <file> writes every Dynasty player still without real cards, one name a line,
highest-rated first (a nickname in quotes left out: Dick Lane, not Dick "Night Train" Lane).
"""
import csv, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'data', 'dynasty.json')
IMG = os.path.join(ROOT, 'img', 'dynasty', 'real')
JS = os.path.join(ROOT, 'js', 'views', 'dynasty-real.js')

# The card to show first where it isn't his newest base card (the card id's first 8): a showpiece insert
FIRST = {
    'LaDainian Tomlinson': 'fc82d7dd',  # 2023 Donruss All-Time Gridiron Kings
    'Randy Moss': '3093deb0',           # 2023 Donruss All-Time Gridiron Kings
    'Adrian Peterson': '063fa3a5',      # 2022 Donruss Downtown
    'Josh Allen': '7ea9a460',           # 2025 Donruss Action All-Pros on his Prime card (Gameday and Live take the next)
}


def plain(name):
    return re.sub(r'\s+', ' ', re.sub(r'"[^"]*"', '', name)).strip()


def norm(name):
    return re.sub(r'[^a-z]', '', plain(name).lower())


def players_list(out):
    with open(DATA, encoding='utf-8') as f:
        d = json.load(f)
    with open(JS, encoding='utf-8') as f:
        done = set(re.findall(r"^  '([^']+)': \[\[", f.read(), re.M))
    best = {}
    for c in d['cards']:
        best[c[2]] = max(best.get(c[2], 0), c[3])
    names, seen = [], {norm(d['players'][k][0]) for k in done}
    for k in sorted(best, key=lambda k: (-best[k], d['players'][k][0])):
        n = plain(d['players'][k][0])
        if norm(n) not in seen:
            seen.add(norm(n))
            names.append(n)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Gridiron Dynasty players still without real cards, highest-rated first (tools/dynasty/real_cards.py --players)\n')
        f.write('\n'.join(names) + '\n')
    print(f'{len(names)} players -> {out}')


def js_str(s):
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    if len(sys.argv) < 2:
        sys.exit('usage: real_cards.py <the nfl_cards folder> | --players <file>')
    if sys.argv[1] == '--players':
        return players_list(sys.argv[2])
    src = sys.argv[1]
    with open(DATA, encoding='utf-8') as f:
        d = json.load(f)
    best = {}
    for c in d['cards']:
        best[c[2]] = max(best.get(c[2], 0), c[3])
    by_name = {}
    for k, p in d['players'].items():
        if k in best:
            by_name.setdefault(norm(p[0]), []).append(k)

    with open(os.path.join(src, 'cards.csv'), newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    os.makedirs(IMG, exist_ok=True)
    real, names, unknown, seen = {}, {}, set(), set()
    for r in rows:
        keys = by_name.get(norm(r['player']))
        if not keys:
            unknown.add(r['player'])
            continue
        key, cid = max(keys, key=lambda k: best[k]), r['card_id'][:8]
        if (key, cid) in seen:
            continue
        seen.add((key, cid))
        part = re.split(r'[\\/]', r['file'])
        jpg = os.path.join(src, part[-2], part[-1])
        with open(jpg, 'rb') as f:
            head = f.read(3)
        if head != b'\xff\xd8\xff':
            sys.exit(f'not a JPEG: {jpg}')
        shutil.copyfile(jpg, os.path.join(IMG, f'{key}-{cid}.jpg'))
        names[key] = r['player']
        real.setdefault(key, []).append([cid, int(r['year']), r['release'], r['set'], r['number']])

    for key, cards in real.items():
        cards.sort(key=lambda c: (c[3] != 'Base Set', -c[1], c[2], c[4]))
        first = FIRST.get(names[key])
        cards.sort(key=lambda c: c[0] != first)

    lines = ['export const REAL = {']
    for key, cards in real.items():
        body = ', '.join('[' + ', '.join([js_str(c[0]), str(c[1]), js_str(c[2]), js_str(c[3]), js_str(c[4])]) + ']' for c in cards)
        lines.append(f'  {js_str(key)}: [{body}], // {names[key]}')
    lines.append('};')
    with open(JS, encoding='utf-8') as f:
        js = f.read()
    a, b = js.index('// <real-cards>'), js.index('// </real-cards>')
    a = js.index('\n', a) + 1
    with open(JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js[:a] + '\n'.join(lines) + '\n' + js[b:])
    print(f'{sum(len(c) for c in real.values())} pictures for {len(real)} players -> img/dynasty/real, js/views/dynasty-real.js')
    if unknown:
        print('not in the Dynasty (skipped): ' + ', '.join(sorted(unknown)))


if __name__ == '__main__':
    main()
