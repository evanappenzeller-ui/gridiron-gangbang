#!/usr/bin/env python3
"""The Two-Minute Drill's coach comps: each NFL head coach's late-game play-calling, from nflverse's play-by-play, into
data/drill.json's "coaches" (core/drill.js coachComp matches your calls to the coach whose tendencies fit them best).

Run: python3 tools/drill/coaches.py [data/drill.json]  (standard library and node; tools/drill/build.py runs it last;
it runs tools/drill/comp_base.mjs itself; then bump CACHE in sw.js). Downloads play_by_play_{2025,2026}.csv.gz once into ~/.cache/gridiron-drill/pbp.

THE SNAPS. A coach is the offense's head coach on the play (nflverse's home_coach / away_coach). Late-game snaps: the
last two minutes of either half, the offense within two scores (down 16 to up 8), a pass, a run or a spike (no kneels),
regular season and playoffs, 2018 through 2026 so far. A coach's team is the last he coached (old franchises under
their current ids: the Raiders are LV); y is the first and last season he was a head coach in that span.

THE TENDENCIES, each a count [k, n] (what the game counts the same way from your calls, core/drill.js tendencies):
  pass    snaps that were dropbacks (sacks and scrambles too), of the snaps that weren't spikes
  deep    throws 18+ yards in the air, of the throws with air yards
  short   throws under 8 yards in the air, of the same
  middle  throws to the middle of the field, of the throws with a location
  oob     plays that ended out of bounds, of the completions and runs
  spike   spikes, of every snap
  hurry   no-huddle snaps, of the snaps from a running clock (trailing or tied)
  timeout timeouts he called, of his chances with the clock running and a timeout left (a snap, a spike, a kick or the
          timeout itself; trailing or tied)
  The clock was running before a snap when the play before it in the game was his and kept it going: a catch or a run
  in bounds or a sack, with no timeout, two-minute warning, penalty, score or change of possession in between (as the
  game's own clock: drill-sim.js).
  and from whole games (they're rare late):
  two     two-point tries, of all tries after a touchdown
  fourth  went for it on fourth down inside the 40, of those fourth downs that weren't punted (else a field goal try)
"""
import csv, gzip, json, os, subprocess, sys, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'drill.json')
CACHE = os.path.expanduser('~/.cache/gridiron-drill/pbp')
REL = 'https://github.com/nflverse/nflverse-data/releases/download/pbp'
SEASONS = tuple(range(2018, 2027))
MIN_SNAPS = 75
TEAM = {'LA': 'LAR', 'WAS': 'WSH', 'OAK': 'LV', 'SD': 'LAC', 'STL': 'LAR'}   # nflverse ids -> the game's
FIX = {'Klint Kubliak': 'Klint Kubiak'}          # spellings nflverse has wrong
FEATURES = ('pass', 'deep', 'short', 'middle', 'oob', 'spike', 'hurry', 'timeout', 'two', 'fourth')
STOPS = ('incomplete_pass', 'out_of_bounds', 'penalty', 'interception', 'fumble_lost', 'touchdown', 'safety',
         'two_point_attempt', 'field_goal_attempt', 'extra_point_attempt', 'punt_attempt', 'qb_spike', 'timeout')


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


def runs_on(q):
    """Whether the clock kept running after row q: a catch or a run in bounds or a sack, nothing that stops it."""
    if q is None or not q['posteam'] or q['play_type'] in ('no_play', 'kickoff', ''):
        return False
    d = (q['desc'] or '').lower()
    return not ('two-minute warning' in d or 'end quarter' in d or 'end of half' in d or any(flag(q, k) for k in STOPS))


def coach_of(r, team):
    c = r['home_coach'] if team == r['home_team'] else r['away_coach']
    return FIX.get(c, c)


def main():
    coaches, last, league = {}, {}, {f: [0, 0] for f in FEATURES}
    years = {}

    def add(coach, f, hit):
        c = coaches.setdefault(coach, {'snaps': 0, 'f': {x: [0, 0] for x in FEATURES}})
        c['f'][f][1] += 1
        league[f][1] += 1
        if hit:
            c['f'][f][0] += 1
            league[f][0] += 1

    for season in SEASONS:
        prev, game = None, None
        for r in rows(season):
            if r['game_id'] != game:
                prev, game = None, r['game_id']
            q, prev = prev, r
            # A timeout (its row has no team with the ball): his, called with the clock running after his play.
            if flag(r, 'timeout') and not r['posteam']:
                if q and r['season_type'] in ('REG', 'POST') and r['timeout_team'] == q['posteam'] and runs_on(q):
                    half, diff, coach = num(r['half_seconds_remaining']), num(q['score_differential']), coach_of(q, q['posteam'])
                    if coach and half is not None and half <= 120 and diff is not None and -16 <= diff <= 0:
                        add(coach, 'timeout', True)
                continue
            pos = r['posteam']
            if not pos or r['season_type'] not in ('REG', 'POST'):
                continue
            coach = coach_of(r, pos)
            if not coach:
                continue
            key = (season, int(num(r['week']) or 0))
            if coach not in last or key >= last[coach][0]:
                last[coach] = (key, TEAM.get(pos, pos))
            y = years.setdefault(coach, [season, season])
            y[0], y[1] = min(y[0], season), max(y[1], season)
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
            # The clock: a chance to stop it he let go (he snapped, spiked or kicked from a running clock with a
            # timeout left), and how fast he snapped it from a running one (trailing or tied).
            running = q is not None and q['posteam'] == pos and q['game_half'] == r['game_half'] and runs_on(q)
            chance = flag(r, 'pass') or flag(r, 'rush') or flag(r, 'qb_spike') or flag(r, 'field_goal_attempt')
            if running and diff <= 0 and chance and (num(q['posteam_timeouts_remaining']) or 0) > 0:
                add(coach, 'timeout', False)
            spike, dropback, rush = flag(r, 'qb_spike'), flag(r, 'pass'), flag(r, 'rush')
            if not (spike or dropback or rush):
                continue
            coaches.setdefault(coach, {'snaps': 0, 'f': {x: [0, 0] for x in FEATURES}})['snaps'] += 1
            add(coach, 'spike', spike)
            if spike:
                continue
            if running and diff <= 0:
                add(coach, 'hurry', flag(r, 'no_huddle'))
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
    # How far each tendency really varies from coach to coach (past the noise of his sample): the weight of the league's
    # rate in a coach's (prior: k of it as if from that many snaps; core/drill.js matchCoach), so a short career or a
    # thing every coach does alike doesn't decide a comp.
    def prior(f):
        xs = [(c['f'][f][0], c['f'][f][1]) for name, c in coaches.items() if c['snaps'] >= MIN_SNAPS and c['f'][f][1]]
        n = sum(x[1] for x in xs)
        p = sum(x[0] for x in xs) / n
        spread = sum(m * (k / m - p) ** 2 for k, m in xs) / n - p * (1 - p) * len(xs) / n
        return int(min(400, max(20, p * (1 - p) / max(spread, 1e-6) - 1)))
    out = [{'n': name, 't': last[name][1], 's': c['snaps'], 'y': years[name], 'f': c['f']}
           for name, c in sorted(coaches.items()) if c['snaps'] >= MIN_SNAPS]
    wk = max(k[1] for (k, _) in last.values() if k[0] == SEASONS[-1])
    with open(OUT, encoding='utf-8') as f:
        doc = json.load(f)
    doc['coaches'] = {
        'about': 'Head coaches\' late-game play-calling (the last two minutes of either half, within two scores) from '
                 'nflverse play-by-play. Generated by tools/drill/coaches.py.',
        'seasons': f'{SEASONS[0]}–{SEASONS[-1]}', 'through': f'{SEASONS[-1]} week {wk}',
        'league': {f: rate(league[f]) for f in FEATURES}, 'prior': {f: prior(f) for f in FEATURES}, 'list': out,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} coaches through {SEASONS[-1]} week {wk}; league:', doc['coaches']['league'], 'prior:', doc['coaches']['prior'])
    for c in out:
        print(f"  {c['n']:22} {c['t']:4} {c['y'][0]}-{c['y'][1]} {c['s']:4} snaps  " + '  '.join(f"{f} {rate(c['f'][f]):.2f}" for f in FEATURES))
    # How this game is usually played, to read a player's leans against (tools/drill/comp_base.mjs).
    subprocess.run(['node', os.path.join(ROOT, 'tools', 'drill', 'comp_base.mjs'), OUT], check=True)


if __name__ == '__main__':
    main()
