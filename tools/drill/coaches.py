#!/usr/bin/env python3
"""The Two-Minute Drill's coach comps: each NFL head coach's late-game play-calling, from nflverse's play-by-play, into
data/drill.json's "coaches" (core/drill.js coachComp matches your calls to the coach whose tendencies fit them best).

Run: python3 tools/drill/coaches.py [data/drill.json]  (standard library only; tools/drill/build.py runs it last; then
bump CACHE in sw.js). Downloads play_by_play_{2025,2026}.csv.gz once into ~/.cache/gridiron-drill/pbp.

THE SNAPS. A coach is the offense's head coach on the play (nflverse's home_coach / away_coach). Late-game snaps: the
last two minutes of either half, the offense within two scores (down 16 to up 8), a pass, a run or a spike (no kneels),
regular season and playoffs, 2025 and 2026 so far.

THE TENDENCIES, each a count [k, n] (what the game counts the same way from your calls, core/drill.js tendencies):
  pass    snaps that were dropbacks (sacks and scrambles too), of the snaps that weren't spikes
  deep    throws 18+ yards in the air, of the throws with air yards
  short   throws under 8 yards in the air, of the same
  middle  throws to the middle of the field, of the throws with a location
  oob     plays that ended out of bounds, of the completions and runs
  spike   spikes, of every snap
  and from whole games (they're rare late):
  two     two-point tries, of all tries after a touchdown
  fourth  went for it on fourth down inside the 40, of those fourth downs that weren't punted (else a field goal try)
"""
import csv, gzip, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'drill.json')
CACHE = os.path.expanduser('~/.cache/gridiron-drill/pbp')
REL = 'https://github.com/nflverse/nflverse-data/releases/download/pbp'
SEASONS = (2025, 2026)
MIN_SNAPS = 30
TEAM = {'LA': 'LAR', 'WAS': 'WSH'}               # nflverse ids -> the game's
FIX = {'Klint Kubliak': 'Klint Kubiak'}          # spellings nflverse has wrong
FEATURES = ('pass', 'deep', 'short', 'middle', 'oob', 'spike', 'two', 'fourth')


def rows(season):
    path = os.path.join(CACHE, f'play_by_play_{season}.csv.gz')
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        print('downloading', path)
        with urllib.request.urlopen(f'{REL}/play_by_play_{season}.csv.gz', timeout=600) as r, open(path, 'wb') as f:
            f.write(r.read())
    with gzip.open(path, 'rt', encoding='utf-8', newline='') as f:
        yield from csv.DictReader(f)


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def flag(r, k):
    return r.get(k) in ('1', '1.0', 'TRUE', 'True')


def main():
    coaches, last, league = {}, {}, {f: [0, 0] for f in FEATURES}

    def add(coach, f, hit):
        c = coaches.setdefault(coach, {'snaps': 0, 'f': {x: [0, 0] for x in FEATURES}})
        c['f'][f][1] += 1
        league[f][1] += 1
        if hit:
            c['f'][f][0] += 1
            league[f][0] += 1

    for season in SEASONS:
        for r in rows(season):
            pos = r['posteam']
            if not pos or r['season_type'] not in ('REG', 'POST'):
                continue
            coach = r['home_coach'] if pos == r['home_team'] else r['away_coach']
            coach = FIX.get(coach, coach)
            if not coach:
                continue
            key = (season, int(num(r['week']) or 0))
            if coach not in last or key >= last[coach][0]:
                last[coach] = (key, TEAM.get(pos, pos))
            # Whole-game decisions.
            if flag(r, 'two_point_attempt') or flag(r, 'extra_point_attempt'):
                add(coach, 'two', flag(r, 'two_point_attempt'))
            yl = num(r['yardline_100'])
            if r['down'] in ('4', '4.0') and yl is not None and yl <= 40 and not flag(r, 'punt_attempt'):
                if flag(r, 'field_goal_attempt'):
                    add(coach, 'fourth', False)
                elif flag(r, 'pass') or flag(r, 'rush'):
                    add(coach, 'fourth', True)
            # Late-game snaps.
            half = num(r['half_seconds_remaining'])
            diff = num(r['score_differential'])
            if half is None or half > 120 or diff is None or not -16 <= diff <= 8 or flag(r, 'qb_kneel'):
                continue
            spike, dropback, rush = flag(r, 'qb_spike'), flag(r, 'pass'), flag(r, 'rush')
            if not (spike or dropback or rush):
                continue
            coaches.setdefault(coach, {'snaps': 0, 'f': {x: [0, 0] for x in FEATURES}})['snaps'] += 1
            add(coach, 'spike', spike)
            if spike:
                continue
            add(coach, 'pass', dropback)
            air = num(r['air_yards'])
            if dropback and air is not None:
                add(coach, 'deep', air >= 18)
                add(coach, 'short', air < 8)
            if dropback and r['pass_location'] in ('left', 'middle', 'right'):
                add(coach, 'middle', r['pass_location'] == 'middle')
            if flag(r, 'complete_pass') or rush:
                add(coach, 'oob', flag(r, 'out_of_bounds'))

    rate = lambda kn: round(kn[0] / kn[1], 4) if kn[1] else 0
    out = [{'n': name, 't': last[name][1], 's': c['snaps'], 'f': c['f']}
           for name, c in sorted(coaches.items()) if c['snaps'] >= MIN_SNAPS]
    wk = max(k[1] for (k, _) in last.values() if k[0] == SEASONS[-1])
    with open(OUT, encoding='utf-8') as f:
        doc = json.load(f)
    doc['coaches'] = {
        'about': 'Head coaches\' late-game play-calling (the last two minutes of either half, within two scores) from '
                 'nflverse play-by-play. Generated by tools/drill/coaches.py.',
        'seasons': f'{SEASONS[0]}–{SEASONS[-1]}', 'through': f'{SEASONS[-1]} week {wk}',
        'league': {f: rate(league[f]) for f in FEATURES}, 'list': out,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} coaches through {SEASONS[-1]} week {wk}; league:', doc['coaches']['league'])
    for c in out:
        print(f"  {c['n']:22} {c['t']:4} {c['s']:4} snaps  " + '  '.join(f"{f} {rate(c['f'][f]):.2f}" for f in FEATURES))


if __name__ == '__main__':
    main()
