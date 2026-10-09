#!/usr/bin/env python3
"""Builds data/seventeen.json for 17-0 (js/views/seventeen.js, js/core/seventeen.js) from nflverse data: one board a
day for DAYS days from START (the app wraps around after the last). Run: python3 tools/seventeen/build.py (then bump
CACHE in sw.js). Standard library only. The same nflverse files give the same boards: everything is seeded by day.

  python3 tools/seventeen/build.py              write data/seventeen.json and print a summary and the first boards
  python3 tools/seventeen/build.py who NAME...  print every season of these players with the model's numbers

The nflverse files (regular-season player stats 2006-2025, the players table, the schedules) are downloaded once
into CACHE (env SEVENTEEN_CACHE, default ~/.cache/gridiron-seventeen).

HEADSHOTS ('h' on a card; NFL.com's own photos). The per-season rosters (nflreadr::load_rosters(), the headshot_url
column) carry the photo the NFL used each season, but only from PHOTO_FROM on: earlier seasons repeat a later photo
(every Tom Brady row 2006-2015 has his 2022 one). So a card's photo is
  1. his roster photo from the prime season itself, for primes from PHOTO_FROM on (2022 Nick Chubb: his Browns photo);
  2. else his earliest roster photo from PHOTO_FROM on, the closest to an older prime (2007 Brady: his 2016 one);
  3. else the headshot column of the players table, the file nflreadr::load_players() reads (players retired
     before PHOTO_FROM: the one photo the NFL kept).
'e' (the ESPN id) is the app's backup when that photo doesn't load.

THE MODEL (everything in points, from EPA: expected points added, play by play)
  Credit. A pass play's EPA counts for the passer and for the receiver, so it is split: the receiver keeps
    RECV_SHARE of his receiving EPA and the passer keeps the rest (his passing EPA minus RECV_SHARE of the
    receiving EPA his team's receivers earned on his throws, by his share of the team's attempts).
    QB  passing (net of the receivers' share) + rushing EPA, over dropbacks and runs
    RB  rushing EPA + RECV_SHARE x receiving EPA, over carries and targets
    WR, TE  RECV_SHARE x receiving EPA + rushing EPA, over targets and carries
  Replacement. Each position's replacement level is the REP_PCT percentile of credited EPA per play among that
    position's regulars, 2006-2025. A season's value = credited EPA - replacement rate x plays: points the player
    added over a replacement-level player on the same workload.
  Prime. A player's prime is the season people remember (2022 Nick Chubb, 1,525 rushing yards, not 2025's 506):
    the best of PPR fantasy points plus PRIME_EPA x value, each in standard deviations of that position's regular
    seasons (16-game seasons scaled to 17). PINS sets a few by hand (2007 Tom Brady).
  Pool. Every player whose prime is notable: at least POOL_PPR fantasy points (per 17 games) on a starter's
    workload, with an ESPN id and an nflverse headshot.
  Team. Team points per game = BASE + sum over QB, RB, WR, WR, TE of weight x value per team game, a least-squares
    fit over every team-season 2006-2025 (each team's busiest QB, RB, two WRs and TE). 'imp' on a card is that
    player's weighted value per game: what he adds to the scoreboard every week.
  Season. Your lineup's defense is league average. Against opponent o (a real team-season): you score ppg + (o's
    points allowed per game - that season's league average) and o scores its points per game. A projected win is a
    win: you go 17-0 by outscoring all seventeen.
  Board. Each day draws 5 QBs, 5 RBs, 10 WRs (two columns) and 5 TEs from the pool, none seen in the last
    COOLDOWN days, no two with one name. Prices are fantasy reputation: within a column the biggest fantasy season
    costs $5, the smallest $1. The season is decided by the model, so the bargains are the seasons worth more than
    their fantasy points. A draw is kept when the price order and the model disagree somewhere (MIN_SURPRISE pairs)
    and at most MAX_PERFECT lineups go 17-0; else the best of MAX_TRIES draws.
  Schedule. Each board plays 17 real team-seasons (2006-2025), picked so the records spread: the k-th toughest game
    sits at the TARGET quantile of the board's sensible lineups (those spending $13-$15), and the toughest, in week
    17, is the best team the board's perfect lineup still beats. So only the top of the board runs the table.
"""
import csv
import datetime
import json
import math
import os
import random
import statistics
import sys
import urllib.request

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'seventeen.json')
CACHE = os.environ.get('SEVENTEEN_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', 'gridiron-seventeen')
REL = 'https://github.com/nflverse/nflverse-data/releases/download'
FIRST, LAST = 2006, 2025
RECV_SHARE = 0.5
REP_PCT = 0.20
PRIME_EPA = 0.4
QUALIFY = {'QB': 300, 'RB': 150, 'WR': 60, 'TE': 40}  # plays (QB, RB) or targets (WR, TE) to count as a regular
TARGET = (10.0, 3.0)  # wins of a sensible lineup: mean, spread
START, DAYS = '2026-10-09', 365  # board 1's date, boards written
POOL_PPR = {'QB': 280, 'RB': 225, 'WR': 225, 'TE': 160}  # prime fantasy points per 17 games to be in the pool
POOL_USE = {'QB': ('attempts', 300), 'RB': ('carries', 120), 'WR': ('targets', 60), 'TE': ('targets', 40)}
COOLDOWN = 7
PHOTO_FROM = 2016  # the first season whose roster photos are that season's own
MIN_SURPRISE, MAX_PERFECT, MAX_TRIES = 3, 3, 80
BUDGET = 15
TIERS = [5, 4, 3, 2, 1]
COLS = ['QB', 'RB', 'WR', 'WR', 'TE']
LABELS = ['QB', 'RB', 'WR1', 'WR2', 'TE']
# Primes set by hand (by nflverse player id), where the rule picks a different year than fans remember.
PINS = {'00-0019596': 2007, '00-0026143': 2016}  # Tom Brady (50 TDs), Matt Ryan (MVP)
# Names as fans know them, where nflverse's differ (by player id).
SHOW_AS = {'00-0020337': 'Steve Smith Sr.'}

# Franchise colours (tools/themes.py: the card's background hue and its accent), by ESPN abbreviation.
COLORS = {
    'ARI': ('#97233F', '#FF4D6D'), 'ATL': ('#A71930', '#FF4B5C'), 'BAL': ('#241773', '#9E86FF'), 'BUF': ('#00338D', '#4D8DFF'),
    'CAR': ('#0085CA', '#33B5F5'), 'CHI': ('#0B162A', '#FF6A1A'), 'CIN': ('#FB4F14', '#FF6A2B'), 'CLE': ('#311D00', '#FF5A1F'),
    'DAL': ('#003594', '#5B8FFF'), 'DEN': ('#002244', '#FF6A2B'), 'DET': ('#0076B6', '#3DB4FF'), 'GB': ('#203731', '#FFB612'),
    'HOU': ('#03202F', '#E8304A'), 'IND': ('#002C5F', '#3F8CFF'), 'JAX': ('#006778', '#1FC2D6'), 'KC': ('#E31837', '#FF3B55'),
    'LV': ('#000000', '#C4C9CC'), 'LAC': ('#0080C6', '#3DB2FF'), 'LAR': ('#003594', '#FFB41F'), 'MIA': ('#008E97', '#1FD1DB'),
    'MIN': ('#4F2683', '#A979FF'), 'NE': ('#002244', '#FF3D57'), 'NO': ('#101820', '#D3BC8D'), 'NYG': ('#0B2265', '#4D74FF'),
    'NYJ': ('#125740', '#2FD08A'), 'PHI': ('#004C54', '#2FC4B2'), 'PIT': ('#101820', '#FFB612'), 'SF': ('#AA0000', '#FF3B3B'),
    'SEA': ('#002244', '#69BE28'), 'TB': ('#D50A0A', '#FF7900'), 'TEN': ('#0C2340', '#4B92DB'), 'WSH': ('#5A1414', '#FFB612'),
}
NAMES = {
    'ARI': 'Cardinals', 'ATL': 'Falcons', 'BAL': 'Ravens', 'BUF': 'Bills', 'CAR': 'Panthers', 'CHI': 'Bears', 'CIN': 'Bengals',
    'CLE': 'Browns', 'DAL': 'Cowboys', 'DEN': 'Broncos', 'DET': 'Lions', 'GB': 'Packers', 'HOU': 'Texans', 'IND': 'Colts',
    'JAX': 'Jaguars', 'KC': 'Chiefs', 'LV': 'Raiders', 'LAC': 'Chargers', 'LAR': 'Rams', 'MIA': 'Dolphins', 'MIN': 'Vikings',
    'NE': 'Patriots', 'NO': 'Saints', 'NYG': 'Giants', 'NYJ': 'Jets', 'PHI': 'Eagles', 'PIT': 'Steelers', 'SF': '49ers',
    'SEA': 'Seahawks', 'TB': 'Buccaneers', 'TEN': 'Titans', 'WSH': 'Commanders',
}
# nflverse franchise codes -> ESPN's (the player stats use today's code for every season; the schedules use the old ones).
FRANCHISE = {'LA': 'LAR', 'WAS': 'WSH', 'OAK': 'LV', 'SD': 'LAC', 'STL': 'LAR'}


def era_abbr(code, season):
    """The team's abbreviation that season (the Chargers were SD through 2016, the Rams STL through 2015, the Raiders OAK
    through 2019)."""
    f = FRANCHISE.get(code, code)
    if f == 'LAC' and season <= 2016:
        return 'SD'
    if f == 'LAR' and season <= 2015:
        return 'STL'
    if f == 'LV' and season <= 2019:
        return 'OAK'
    return f


def era_name(code, season):
    f = FRANCHISE.get(code, code)
    if f == 'WSH':
        return 'Redskins' if season <= 2019 else 'Football Team' if season <= 2021 else 'Commanders'
    return NAMES[f]


# ------------------------------------------------------------------ Download and read
def fetch(name, url):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print('downloading', url, file=sys.stderr)
        with urllib.request.urlopen(url, timeout=120) as r:
            body = r.read()
        with open(path, 'wb') as f:
            f.write(body)
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def fnum(v):
    try:
        x = float(v)
        return 0.0 if math.isnan(x) else x
    except (TypeError, ValueError):
        return 0.0


def percentile(xs, p):
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    lo = math.floor(k)
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def solve(A, b):
    """Gaussian elimination for the normal equations."""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[piv] = M[piv], M[c]
        for r in range(n):
            if r != c:
                k = M[r][c] / M[c][c]
                M[r] = [x - k * y for x, y in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] for i in range(n)]


def lstsq(X, y):
    n = len(X[0])
    A = [[sum(r[i] * r[j] for r in X) for j in range(n)] for i in range(n)]
    b = [sum(r[i] * t for r, t in zip(X, y)) for i in range(n)]
    return solve(A, b)


def team_games(season):
    return 17 if season >= 2021 else 16


# ------------------------------------------------------------------ Seasons
def load_seasons():
    rows = []
    for y in range(FIRST, LAST + 1):
        rows += fetch(f'stats_player_reg_{y}.csv', f'{REL}/stats_player/stats_player_reg_{y}.csv')
    out = []
    for r in rows:
        pos = r['position']
        if pos == 'FB':
            pos = 'RB'
        if pos not in ('QB', 'RB', 'WR', 'TE'):
            continue
        s = {k: fnum(r.get(k)) for k in (
            'games', 'completions', 'attempts', 'passing_yards', 'passing_tds', 'passing_interceptions', 'sacks_suffered',
            'passing_epa', 'passing_cpoe', 'pacr', 'passing_air_yards', 'carries', 'rushing_yards', 'rushing_tds',
            'rushing_epa', 'rushing_first_downs', 'receptions', 'targets', 'receiving_yards', 'receiving_tds',
            'receiving_epa', 'receiving_air_yards', 'receiving_yards_after_catch', 'receiving_first_downs', 'racr',
            'target_share', 'air_yards_share', 'wopr', 'fantasy_points_ppr', 'rushing_fumbles_lost',
            'receiving_fumbles_lost', 'sack_fumbles_lost')}
        s.update(id=r['player_id'], name=r['player_display_name'], pos=pos, season=int(r['season']), team=r['recent_team'],
                 cpoe_raw=r.get('passing_cpoe'))
        out.append(s)
    # Team receiving EPA and attempts, for the passer's split.
    team = {}
    for s in out:
        t = team.setdefault((s['season'], s['team']), {'rec': 0.0, 'att': 0.0})
        t['rec'] += s['receiving_epa']
        t['att'] += s['attempts']
    for s in out:
        t = team[(s['season'], s['team'])]
        p = s['pos']
        if p == 'QB':
            f = s['attempts'] / t['att'] if t['att'] else 0
            s['credit'] = s['passing_epa'] - RECV_SHARE * f * t['rec'] + s['rushing_epa']
            s['plays'] = s['attempts'] + s['sacks_suffered'] + s['carries']
            s['use'] = s['attempts'] + s['carries']
        elif p == 'RB':
            s['credit'] = s['rushing_epa'] + RECV_SHARE * s['receiving_epa']
            s['plays'] = s['carries'] + s['targets']
            s['use'] = s['plays']
        else:
            s['credit'] = RECV_SHARE * s['receiving_epa'] + s['rushing_epa']
            s['plays'] = s['targets'] + s['carries']
            s['use'] = s['targets']
    rep = {}
    for p, q in QUALIFY.items():
        rates = [s['credit'] / s['plays'] for s in out if s['pos'] == p and (s['targets'] if p in ('WR', 'TE') else s['plays']) >= q]
        rep[p] = percentile(rates, REP_PCT)
    for s in out:
        s['value'] = s['credit'] - rep[s['pos']] * s['plays']
        s['pg'] = s['value'] / team_games(s['season'])
    return out, rep


def load_games():
    rows = fetch('games.csv', f'{REL}/schedules/games.csv')
    games = []
    for r in rows:
        if r['game_type'] != 'REG' or not r['home_score']:
            continue
        y = int(r['season'])
        if y < FIRST or y > LAST:
            continue
        games.append((y, FRANCHISE.get(r['home_team'], r['home_team']), FRANCHISE.get(r['away_team'], r['away_team']),
                      float(r['home_score']), float(r['away_score'])))
    teams, lg = {}, {}
    for y, h, a, hs, as_ in games:
        for t, pf, pa in ((h, hs, as_), (a, as_, hs)):
            d = teams.setdefault((y, t), [0.0, 0.0, 0])
            d[0] += pf
            d[1] += pa
            d[2] += 1
        l = lg.setdefault(y, [0.0, 0])
        l[0] += hs + as_
        l[1] += 2
    rating = {k: {'pf': v[0] / v[2], 'pa': v[1] / v[2], 'g': v[2]} for k, v in teams.items()}
    avg = {y: v[0] / v[1] for y, v in lg.items()}
    return rating, avg


def fit(seasons, rating):
    by_team = {}
    for s in seasons:
        by_team.setdefault((s['season'], FRANCHISE.get(s['team'], s['team'])), []).append(s)
    X, y = [], []
    for key, ss in by_team.items():
        if key not in rating:
            continue
        def top(p, k):
            v = sorted((s for s in ss if s['pos'] == p), key=lambda s: -s['use'])[:k]
            return [s['pg'] for s in v] + [0.0] * (k - len(v))
        X.append([1.0, top('QB', 1)[0], top('RB', 1)[0], sum(top('WR', 2)), top('TE', 1)[0]])
        y.append(rating[key]['pf'])
    b = lstsq(X, y)
    pred = [sum(c * x for c, x in zip(b, r)) for r in X]
    mean = sum(y) / len(y)
    r2 = 1 - sum((a - p) ** 2 for a, p in zip(y, pred)) / sum((a - mean) ** 2 for a in y)
    # Rounded here, as stored in the JSON, so the schedules below and js/core/seventeen.js add up the same numbers.
    return {'base': round(b[0], 3), 'w': {'QB': round(b[1], 4), 'RB': round(b[2], 4), 'WR': round(b[3], 4), 'TE': round(b[4], 4)},
            'r2': r2, 'n': len(y)}


# ------------------------------------------------------------------ Cards
def norm(s):
    return ''.join(c for c in s.lower() if c.isalnum())


def signed(x, dp=1):
    return ('+' if x >= 0 else '−') + f'{abs(x):.{dp}f}'


def nf(x):
    return f'{int(round(x)):,}'


def line_of(s):
    p = s['pos']
    if p == 'QB':
        out = [f"{nf(s['passing_yards'])} pass yds", f"{int(s['passing_tds'])} TD", f"{int(s['passing_interceptions'])} INT"]
        if s['rushing_yards'] >= 250:
            out.append(f"{nf(s['rushing_yards'])} rush yds")
            if s['rushing_tds'] >= 3:
                out.append(f"{int(s['rushing_tds'])} rush TD")
        return out
    if p == 'RB':
        out = [f"{nf(s['rushing_yards'])} rush yds", f"{int(s['rushing_tds'] + s['receiving_tds'])} TD"]
        if s['receiving_yards'] >= 200:
            out.insert(1, f"{nf(s['receiving_yards'])} rec yds")
        return out
    return [f"{int(s['receptions'])} rec", f"{nf(s['receiving_yards'])} yds", f"{int(s['receiving_tds'])} TD"]


def adv_of(s):
    """The advanced numbers on a card's back: [label, value] pairs. Never the model's own value (imp is the answer)."""
    p = s['pos']
    out = []
    if p == 'QB':
        db = s['attempts'] + s['sacks_suffered'] + s['carries'] or 1
        out.append(['EPA per play', signed((s['passing_epa'] + s['rushing_epa']) / db, 2)])
        if s['cpoe_raw'] not in ('', 'NA', None):
            out.append(['CPOE', signed(s['passing_cpoe'], 1) + '%'])
        out.append(['Yards per attempt', f"{s['passing_yards'] / (s['attempts'] or 1):.1f}"])
        out.append(['TD rate', f"{100 * s['passing_tds'] / (s['attempts'] or 1):.1f}%"])
    elif p == 'RB':
        out.append(['Rushing EPA', signed(s['rushing_epa'], 1)])
        out.append(['Yards per carry', f"{s['rushing_yards'] / (s['carries'] or 1):.1f}"])
        out.append(['First-down rate', f"{100 * s['rushing_first_downs'] / (s['carries'] or 1):.0f}%"])
        if s['targets'] >= 30:
            out.append(['Receiving EPA', signed(s['receiving_epa'], 1)])
    else:
        out.append(['EPA per target', signed(s['receiving_epa'] / (s['targets'] or 1), 2)])
        if s['target_share']:
            out.append(['Target share', f"{100 * s['target_share']:.0f}%"])
        if s['wopr']:
            out.append(['WOPR', f"{s['wopr']:.2f}"])
        out.append(['Yards per target', f"{s['receiving_yards'] / (s['targets'] or 1):.1f}"])
    return out


def photo_of(s, rosters, fallback):
    """(headshot URL, where it came from): see HEADSHOTS in the docstring."""
    mine = rosters.get(s['id'], {})
    if s['season'] >= PHOTO_FROM and mine.get(s['season']):
        return mine[s['season']], 'prime'
    later = sorted(y for y in mine if y >= PHOTO_FROM and mine[y])
    if later:
        # Nearest season to the prime (the first one after it for older primes).
        y = min(later, key=lambda y: (abs(y - s['season']), y))
        return mine[y], 'nearest'
    return fallback, 'players'


def load_rosters():
    """{gsis_id: {season: headshot_url}} from the per-season rosters, PHOTO_FROM-LAST (the seasons with their own photos)."""
    out = {}
    for y in range(PHOTO_FROM, LAST + 1):
        for r in fetch(f'roster_{y}.csv', f'{REL}/rosters/roster_{y}.csv'):
            u = r.get('headshot_url') or ''
            if r.get('gsis_id') and u.startswith('https://'):
                out.setdefault(r['gsis_id'], {}).setdefault(int(r['season']), u)
    return out


def card(s, w, heads):
    h = heads.get(s['id'], {})
    f = FRANCHISE.get(s['team'], s['team'])
    imp = w[s['pos']] * s['pg']
    return {
        'n': s['name'], 'p': s['pos'], 'y': s['season'], 't': era_abbr(s['team'], s['season']), 'f': f,
        'tn': era_name(s['team'], s['season']), 'e': h.get('espn', ''), 'h': h.get('url', ''), 'g': int(s['games']),
        'line': line_of(s), 'adv': adv_of(s), 'imp': round(imp, 2), 'v': round(s['value']),
    }


def primes(seasons):
    """{player id: the season his card shows}, and score(season) (the prime rule's number)."""
    scale = {}
    for p, q in QUALIFY.items():
        reg = [x for x in seasons if x['pos'] == p and (x['targets'] if p in ('WR', 'TE') else x['plays']) >= q]
        f = [x['fantasy_points_ppr'] * 17 / team_games(x['season']) for x in reg]
        v = [x['value'] * 17 / team_games(x['season']) for x in reg]
        scale[p] = (statistics.pstdev(f), statistics.pstdev(v))

    def score(x):
        k = 17 / team_games(x['season'])
        fs, vs = scale[x['pos']]
        return x['fantasy_points_ppr'] * k / fs + PRIME_EPA * x['value'] * k / vs

    best = {}
    for x in seasons:
        k = x['id']
        if k in PINS:
            if x['season'] == PINS[k] and (k not in best or x['pos'] == best[k]['pos']):
                best[k] = x
            continue
        if k not in best or score(x) > score(best[k]):
            best[k] = x
    return best, score


def pool_of(prime, heads):
    """The notable primes, as cards' source seasons."""
    out = []
    for k, x in prime.items():
        stat, need = POOL_USE[x['pos']]
        h = heads.get(k, {})
        if x['fantasy_points_ppr'] * 17 / team_games(x['season']) < POOL_PPR[x['pos']] or x[stat] < need:
            continue
        if not h.get('espn') or not h.get('url'):
            continue
        out.append(x)
    return sorted(out, key=lambda x: (x['pos'], -x['fantasy_points_ppr'], x['id']))


# ------------------------------------------------------------------ Season (the same rules as js/core/seventeen.js)
def wins(ppg, sched):
    return sum(1 for g in sched if ppg > g['need'])


def lineups(cells, base):
    import itertools
    for pick in itertools.product(range(5), repeat=5):
        cost = sum(TIERS[r] for r in pick)
        if cost <= BUDGET:
            yield base + sum(cells[c][r]['imp'] for c, r in enumerate(pick)), cost, pick


def phi(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def ladder(rating, avg, recs):
    """Every team-season 2006-2025 a board can play: need = the points per game a lineup must beat."""
    teams = []
    for (y, f), r in sorted(rating.items()):
        pa = r['pa'] - avg[y]
        teams.append({'f': f, 'y': y, 'tn': era_name(f, y), 'pf': round(r['pf'], 2), 'pa': round(pa, 2),
                      'need': round(r['pf'] - pa, 2), 'rec': recs.get((y, f), '')})
    return teams


def schedule(cells, base, teams):
    """17 team indexes into teams, weeks 1-17 (home on odd weeks). The k-th easiest game sits at the TARGET quantile
    of the board's sensible lineups ($13-$15); the hardest is the best team the perfect lineup beats, and it comes
    last. The rest are dealt into weeks so the hard ones are spread out."""
    ls = list(lineups(cells, base))
    top = max(p for p, _, _ in ls)
    sensible = sorted(p for p, c, _ in ls if c >= BUDGET - 2)
    mu, sd = TARGET
    targets = [sensible[min(len(sensible) - 1, int(phi((k - 0.5 - mu) / sd) * len(sensible)))] for k in range(1, 17)]
    boss = max((i for i, t in enumerate(teams) if t['need'] < top - 0.01), key=lambda i: teams[i]['need'])
    used = {boss}
    chosen = []
    for tg in targets:
        i = min((i for i, t in enumerate(teams) if i not in used and t['need'] < teams[boss]['need']),
                key=lambda i: abs(teams[i]['need'] - tg))
        used.add(i)
        chosen.append(i)
    by = sorted(chosen, key=lambda i: teams[i]['need'])
    # Weave easiest, hardest, second easiest... rotated so the season opens mid-pack; the boss last.
    order, lo, hi = [], 0, len(by) - 1
    while lo <= hi:
        order.append(by[lo])
        lo += 1
        if lo <= hi:
            order.append(by[hi])
            hi -= 1
    return order[2:] + order[:2] + [boss]


def team_records():
    rows = fetch('games.csv', f'{REL}/schedules/games.csv')
    rec = {}
    for r in rows:
        if r['game_type'] != 'REG' or not r['home_score']:
            continue
        y = int(r['season'])
        h, a = FRANCHISE.get(r['home_team'], r['home_team']), FRANCHISE.get(r['away_team'], r['away_team'])
        hs, as_ = float(r['home_score']), float(r['away_score'])
        for t, me, op in ((h, hs, as_), (a, as_, hs)):
            d = rec.setdefault((y, t), [0, 0, 0])
            d[0 if me > op else 1 if me < op else 2] += 1
    return {k: (f'{v[0]}\u2013{v[1]}' + (f'\u2013{v[2]}' if v[2] else '')) for k, v in rec.items()}


# ------------------------------------------------------------------ Daily boards
def price(cols):
    """Columns of five seasons -> the same, $5 first: the biggest fantasy season costs the most."""
    return [sorted(col, key=lambda x: (-x['fantasy_points_ppr'] * 17 / team_games(x['season']), x['id'])) for col in cols]


def surprise(cells):
    """Pairs in a column where the cheaper season is worth clearly more to the model (by 0.4 points a game)."""
    n = 0
    for col in cells:
        for i in range(5):
            for j in range(i + 1, 5):
                n += col[j]['imp'] > col[i]['imp'] + 0.4
    return n


def draw(day, cards, last_used, base, teams):
    """Board `day` (0-based): 25 card indexes (column by column, $5 first), its schedule and stats."""
    rnd = random.Random(f'17-0 day {day}')
    by_pos = {p: [i for i, c in enumerate(cards) if c['p'] == p] for p in ('QB', 'RB', 'WR', 'TE')}
    fresh = {p: [i for i in ix if day - last_used.get(i, -99) >= COOLDOWN] for p, ix in by_pos.items()}
    best = None
    for _ in range(MAX_TRIES):
        names, pick = set(), {}
        ok = True
        for p, k in (('QB', 5), ('RB', 5), ('WR', 10), ('TE', 5)):
            opts = [i for i in fresh[p] if cards[i]['n'] not in names]
            if len(opts) < k:
                opts = [i for i in by_pos[p] if cards[i]['n'] not in names]
            got = []
            for i in rnd.sample(opts, len(opts)):
                if cards[i]['n'] in names:
                    continue
                names.add(cards[i]['n'])
                got.append(i)
                if len(got) == k:
                    break
            ok = ok and len(got) == k
            pick[p] = got
        if not ok:
            continue
        cols = [pick['QB'], pick['RB'], pick['WR'][:5], pick['WR'][5:], pick['TE']]
        priced = [sorted(col, key=lambda i: (-cards[i]['_fp'], cards[i]['n'])) for col in cols]
        cells = [[cards[i] for i in col] for col in priced]
        ls = sorted(lineups(cells, base), key=lambda x: -x[0])
        sched = schedule(cells, base, teams)
        perfect = sum(1 for p, _, _ in ls if wins(p, [teams[i] for i in sched]) == 17)
        top_cost, sur = ls[0][1], surprise(cells)
        score = min(sur, 8) + (top_cost >= BUDGET - 2) * 3 - 2 * max(0, perfect - MAX_PERFECT)
        cand = {'cells': priced, 'sched': sched, 'surprise': sur, 'perfect': perfect, 'score': score}
        if sur >= MIN_SURPRISE and top_cost >= BUDGET - 2 and perfect <= MAX_PERFECT:
            return cand
        if not best or score > best['score']:
            best = cand
    return best


def report(boards, cards, teams, base):
    perfect, tops, bosses, sens = [], [], {}, {}
    for d in boards:
        cells = [[cards[i] for i in col] for col in d['cells']]
        sched = [teams[i] for i in d['sched']]
        ls = list(lineups(cells, base))
        perfect.append(sum(1 for p, _, _ in ls if wins(p, sched) == 17))
        tops.append(max(p for p, _, _ in ls))
        b = sched[-1]
        bosses[f"{b['y']} {b['tn']}"] = bosses.get(f"{b['y']} {b['tn']}", 0) + 1
        for p, c, _ in ls:
            if c >= BUDGET - 2:
                w = wins(p, sched)
                sens[w] = sens.get(w, 0) + 1
    tot = sum(sens.values())
    print(f"{len(boards)} boards. Lineups going 17-0 per board: {dict(sorted({k: perfect.count(k) for k in set(perfect)}.items()))}")
    print(f"perfect team ppg {min(tops):.1f}-{max(tops):.1f}; surprise pairs per board {min(d['surprise'] for d in boards)}-{max(d['surprise'] for d in boards)}")
    print('wins of $13-$15 lineups (all boards, %):', {k: round(100 * v / tot, 1) for k, v in sorted(sens.items(), reverse=True)})
    print('most common week-17 bosses:', sorted(bosses.items(), key=lambda kv: -kv[1])[:6])
    for n, d in enumerate(boards[:3]):
        cells = [[cards[i] for i in col] for col in d['cells']]
        sched = [teams[i] for i in d['sched']]
        print(f"\n== Board {n + 1}")
        for r in range(5):
            print(f'  ${TIERS[r]} ' + ' | '.join(f"{cells[c][r]['n'][:18]:<18} {cells[c][r]['y']} {cells[c][r]['imp']:5.2f}" for c in range(5)))
        p, c, pick = max(lineups(cells, base), key=lambda x: x[0])
        print(f"  perfect: {p:.2f} ppg, ${c}: " + ', '.join(f"{cells[ci][r]['n']} {cells[ci][r]['y']}" for ci, r in enumerate(pick)))
        print('  schedule: ' + ', '.join(f"{t['y']} {t['tn']} ({t['need']:.1f})" for t in sched))


def main():
    seasons, rep = load_seasons()
    rating, avg = load_games()
    model = fit(seasons, rating)
    # The players table, as nflreadr::load_players() reads it: headshots and ESPN ids by gsis_id.
    players = fetch('players.csv', f'{REL}/players/players.csv')
    heads = {}
    for p in players:
        e = p.get('espn_id') or ''
        if e.endswith('.0'):
            e = e[:-2]
        heads[p['gsis_id']] = {'espn': e if e.isdigit() else '', 'url': p.get('headshot') or ''}
    prime, score = primes(seasons)

    if len(sys.argv) > 1 and sys.argv[1] == 'who':
        want = {norm(n) for n in sys.argv[2:]}
        for s in sorted(seasons, key=lambda s: (s['name'], s['id'], s['season'])):
            if norm(s['name']) in want:
                star = '*' if prime.get(s['id']) is s else ' '
                print(f"{star} {s['name']:<22} {s['season']} {s['pos']} {s['team']:<4} g{int(s['games']):>2}  value {s['value']:6.1f}"
                      f"  imp {model['w'][s['pos']] * s['pg']:5.2f}  fp {s['fantasy_points_ppr']:5.1f}  {' · '.join(line_of(s))}")
        return

    print(f"model: base {model['base']:.2f}, weights " + ', '.join(f'{k} {v:.3f}' for k, v in model['w'].items())
          + f", R^2 {model['r2']:.3f} over {model['n']} team-seasons; replacement per play "
          + ', '.join(f'{k} {v:+.3f}' for k, v in rep.items()))
    pool = pool_of(prime, heads)
    rosters = load_rosters()
    cards, photos = [], {}
    for x in pool:
        c = card(x, model['w'], heads)
        c['h'], src = photo_of(x, rosters, c['h'])
        photos[src] = photos.get(src, 0) + 1
        if x['id'] in SHOW_AS:
            c['n'] = SHOW_AS[x['id']]
        c['_fp'] = x['fantasy_points_ppr'] * 17 / team_games(x['season'])
        cards.append(c)
    print('pool:', {p: sum(1 for c in cards if c['p'] == p) for p in ('QB', 'RB', 'WR', 'TE')},
          '· photos:', photos)
    teams = ladder(rating, avg, team_records())
    boards, last_used = [], {}
    for day in range(DAYS):
        d = draw(day, cards, last_used, model['base'], teams)
        for col in d['cells']:
            for i in col:
                last_used[i] = day
        boards.append(d)
    report(boards, cards, teams, model['base'])

    # Only what the boards use: cards and teams renumbered in order of first use.
    cmap, tmap = {}, {}
    for d in boards:
        for col in d['cells']:
            for i in col:
                cmap.setdefault(i, len(cmap))
        for i in d['sched']:
            tmap.setdefault(i, len(tmap))
    out_cards = [None] * len(cmap)
    for i, j in cmap.items():
        c = dict(cards[i])
        for k in ('_fp', 'v'):
            c.pop(k, None)
        out_cards[j] = c
    out_teams = [None] * len(tmap)
    for i, j in tmap.items():
        t = teams[i]
        out_teams[j] = [t['f'], t['y'], t['tn'], t['pf'], t['pa'], t['need'], t['rec']]
    doc = {
        'about': 'Daily boards and the season model for 17-0. Generated by tools/seventeen/build.py from nflverse data '
                 f'(regular seasons {FIRST}-{LAST}); change the rules there, not here.',
        'asof': f'{LAST} season',
        'start': START,
        'model': {'base': model['base'], 'w': model['w'], 'r2': round(model['r2'], 3), 'n': model['n'], 'share': RECV_SHARE, 'rep': REP_PCT},
        'budget': BUDGET, 'tiers': TIERS, 'cols': LABELS,
        'colors': COLORS,
        'cards': out_cards,
        'teams': out_teams,
        # A day: 25 card indexes (QB $5..$1, RB $5..$1, WR1, WR2, TE), then 17 team indexes (weeks 1-17).
        'days': [[cmap[i] for col in d['cells'] for i in col] + [tmap[i] for i in d['sched']] for d in boards],
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print('\nwrote', os.path.relpath(OUT, ROOT), f'({os.path.getsize(OUT):,} bytes, {len(out_cards)} cards, {len(out_teams)} teams)')


if __name__ == '__main__':
    main()
