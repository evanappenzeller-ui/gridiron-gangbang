#!/usr/bin/env python3
"""Makes a puzzle day's Mystery player someone outside the NFL data (a league friend, a college player).

  python3 tools/puzzles/mystery.py SPEC.json

SPEC: {"date": "2026-10-15", "replace": "grid", "name": "First Last", "pos": "LB", "first": 2019, "last": 2022,
       "college": "Simpson", "clues": [["Position", "..."], ... seven [label, text] pairs]}

It appends the player to data/puzzles-v4.json's P (so the guess picker finds him; P rows are [name, team codes,
position, draft, first season, last season, college codes, fame]) and N (the stats row every Mystery answer has; old
builds that don't know `wx` build their clues from it), makes him the day's `w`, puts the Mystery in place of
`replace` in the day's puzzles (`t`) if the day doesn't have one, and stores the clues as the day's `wx`
(js/core/daily.js whoClues uses them). Running it again for the same name reuses his row. Standard library only.
"""
import datetime
import json
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
FILE = os.path.join(ROOT, 'data', 'puzzles-v4.json')
POS = {'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P', 'LS', 'ST'}
STEPS = {'col', 'sil', 'who', 'jr', 'grid', 'play'}


def main(path):
    spec = json.load(open(path, encoding='utf-8'))
    doc = json.load(open(FILE, encoding='utf-8'))
    y, m, d = map(int, doc['start'].split('-'))
    n = (datetime.date.fromisoformat(spec['date']) - datetime.date(y, m, d)).days + 1
    if n < 1:
        sys.exit(f"{spec['date']} is before the first puzzle day ({doc['start']})")
    day = doc['days'][(n - 1) % len(doc['days'])]
    if day.get('v') != 4:
        sys.exit(f'puzzle day {n} is not a v4 day')
    clues = spec['clues']
    if len(clues) != 7 or any(len(c) != 2 or not str(c[0]).strip() or not str(c[1]).strip() for c in clues):
        sys.exit('clues: seven [label, text] pairs')
    if spec['pos'] not in POS:
        sys.exit(f"pos must be one of {sorted(POS)}")
    name = spec['name'].strip()
    i = next((k for k, p in enumerate(doc['P']) if p[0] == name and p[3] == 'X'), None)
    row = [name, '', spec['pos'], 'X', int(spec['first']), int(spec['last']), '', 1]
    if i is None:
        doc['P'].append(row)
        i = len(doc['P']) - 1
    else:
        doc['P'][i] = row
    # Undrafted, no NFL numbers: what an older build shows if it builds the clues itself.
    doc['N'][str(i)] = ['Undrafted', '–', '–', 0, 0, 0, 0, [0] * 11, spec.get('college', '')]
    t = day['t']
    if 'who' not in t:
        rep = spec.get('replace')
        if rep not in t:
            sys.exit(f"day {n} plays {t}: name the one the Mystery replaces ('replace')")
        t[t.index(rep)] = 'who'
        drop = {'grid': 'g', 'col': 'c', 'sil': 's', 'jr': 'j', 'play': 'y'}.get(rep)
        if drop:
            day.pop(drop, None)
    day['w'] = i
    day['wx'] = {'clues': [[str(a).strip(), str(b).strip()] for a, b in clues]}
    with open(FILE, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    print(f"puzzle day {n} ({spec['date']}): {t}, Mystery player {name} (P[{i}])")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
