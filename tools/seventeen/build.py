#!/usr/bin/env python3
"""Builds data/seventeen.json for 17-0 (js/views/seventeen.js, js/core/seventeen.js) from nflverse data.
Run: python3 tools/seventeen/build.py   (then bump CACHE in sw.js). Standard library only.

  python3 tools/seventeen/build.py              write data/seventeen.json and print each board's best lineups
  python3 tools/seventeen/build.py who NAME...  print every season of these players with the model's numbers

The nflverse files (regular-season player stats 2006-2025, the players table, the schedules) are downloaded once
into CACHE (env SEVENTEEN_CACHE, default ~/.cache/gridiron-seventeen).

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
    seasons (16-game seasons scaled to 17). A board can pin a year ('Tom Brady|2007') or a team ('Steve Smith|CAR').
  Team. Team points per game = BASE + sum over QB, RB, WR, WR, TE of weight x value per team game, a least-squares
    fit over every team-season 2006-2025 (each team's busiest QB, RB, two WRs and TE). 'imp' on a card is that
    player's weighted value per game: what he adds to the scoreboard every week.
  Season. Your lineup's defense is league average. Against opponent o (a real team-season): you score ppg + (o's
    points allowed per game - that season's league average) and o scores its points per game. A projected win is a
    win: you go 17-0 by outscoring all seventeen.
  Schedule. Each board plays 17 real team-seasons from its pool (2006-2025), picked so the records spread: the k-th
    toughest game sits at the TARGET quantile of the board's sensible lineups (those spending $13-$15), and the
    toughest, in week 17, is the best team the board's perfect lineup still beats. So only the top of the board
    runs the table.
"""
import csv
import json
import math
import os
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
BUDGET = 15
TIERS = [5, 4, 3, 2, 1]
COLS = ['QB', 'RB', 'WR', 'WR', 'TE']
LABELS = ['QB', 'RB', 'WR1', 'WR2', 'TE']
# Names as fans know them, where nflverse's differ (by the board's spec).
SHOW_AS = {'Steve Smith|CAR': 'Steve Smith Sr.'}

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
NFC = ['ARI', 'ATL', 'CAR', 'CHI', 'DAL', 'DET', 'GB', 'LAR', 'MIN', 'NO', 'NYG', 'PHI', 'SEA', 'SF', 'TB', 'WSH']
AFC = ['BAL', 'BUF', 'CIN', 'CLE', 'DEN', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LV', 'MIA', 'NE', 'NYJ', 'PIT', 'TEN']
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


# ------------------------------------------------------------------ Boards
# Each column lists its five players from $5 down to $1, by nflverse display name. Prices are the board's call
# (what a player costs today, by reputation); every card shows him in his prime. pool: where the board's 17
# opponents come from (NFC or AFC franchises, or ALL), any season 2006-2025.
BOARDS = [
    {
        'id': 'nfc', 'name': 'NFC Only', 'sub': 'Players on NFC teams today, each in his prime.',
        'cols': [
            ['Jalen Hurts', 'Baker Mayfield', 'Matthew Stafford', 'Jordan Love', 'Caleb Williams'],
            ['Christian McCaffrey', 'Saquon Barkley', 'Bijan Robinson', 'Bucky Irving', 'Kyren Williams'],
            ['Puka Nacua', 'Amon-Ra St. Brown', 'Justin Jefferson', 'Jaxon Smith-Njigba', 'Drake London'],
            ['Emeka Egbuka', 'George Pickens', 'Chris Olave', 'Rome Odunze', 'Tetairoa McMillan'],
            ['Trey McBride', 'Sam LaPorta', 'Tucker Kraft', 'Dallas Goedert', 'Jake Ferguson'],
        ],
        'pool': 'NFC',
    },
    {
        'id': 'afc', 'name': 'AFC Only', 'sub': 'Players on AFC teams today, each in his prime.',
        'cols': [
            ['Patrick Mahomes', 'Josh Allen', 'Lamar Jackson', 'Joe Burrow', 'Aaron Rodgers'],
            ['Jonathan Taylor', 'Derrick Henry', "De'Von Achane", 'James Cook', 'Kenneth Walker III'],
            ["Ja'Marr Chase", 'Nico Collins', 'Garrett Wilson', 'Courtland Sutton', 'Keenan Allen'],
            ['Zay Flowers', 'Jaylen Waddle', 'Ladd McConkey', 'Tee Higgins', 'DK Metcalf'],
            ['Brock Bowers', 'Travis Kelce', 'Tyler Warren', 'Mark Andrews', 'Dalton Kincaid'],
        ],
        'pool': 'AFC',
    },
    {
        'id': 'legends', 'name': 'Legends', 'sub': 'The 2006\u20132025 greats, each in his prime.',
        'cols': [
            ['Tom Brady|2007', 'Peyton Manning', 'Drew Brees', 'Ben Roethlisberger', 'Philip Rivers'],
            ['LaDainian Tomlinson', 'Adrian Peterson|MIN', 'Marshawn Lynch', "Le'Veon Bell", 'Jamaal Charles'],
            ['Calvin Johnson', 'Randy Moss', 'Larry Fitzgerald', 'Andre Johnson', 'Wes Welker'],
            ['Julio Jones', 'Antonio Brown', 'Odell Beckham Jr.', 'Steve Smith|CAR', 'Jordy Nelson'],
            ['Rob Gronkowski', 'Tony Gonzalez', 'Antonio Gates', 'Jimmy Graham', 'Jason Witten'],
        ],
        'pool': 'ALL',
    },
    {
        'id': 'faded', 'name': 'Fallen Stars', 'sub': 'Where are they now? Priced like today, played like their best year.',
        'cols': [
            ['Russell Wilson', 'Kirk Cousins', 'Kyler Murray', 'Matt Ryan|2016', 'Derek Carr'],
            ['Ezekiel Elliott', 'Todd Gurley', 'Nick Chubb', 'Joe Mixon', 'Austin Ekeler'],
            ['Tyreek Hill', 'Davante Adams', 'Michael Thomas', 'Cooper Kupp', 'Adam Thielen'],
            ['Stefon Diggs', 'Mike Evans', 'DeAndre Hopkins', 'Jarvis Landry', 'Amari Cooper'],
            ['George Kittle', 'Zach Ertz', 'Darren Waller', 'Evan Engram', 'Kyle Rudolph'],
        ],
        'pool': 'ALL',
    },
]


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


def short(name):
    parts = name.split(' ')
    suf = parts[-1] if parts[-1] in ('Jr.', 'Sr.', 'II', 'III', 'IV') else ''
    core = parts[:-1] if suf else parts
    return f'{core[0][0]}. {" ".join(core[1:])}'


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


def card(s, w, heads):
    h = heads.get(s['id'], {})
    f = FRANCHISE.get(s['team'], s['team'])
    imp = w[s['pos']] * s['pg']
    return {
        'n': s['name'], 's': short(s['name']), 'p': s['pos'], 'y': s['season'], 't': era_abbr(s['team'], s['season']), 'f': f,
        'tn': era_name(s['team'], s['season']), 'e': h.get('espn', ''), 'h': h.get('url', ''), 'g': int(s['games']),
        'line': line_of(s), 'adv': adv_of(s), 'imp': round(imp, 2), 'v': round(s['value']),
    }


def primes(seasons):
    """prime(name_spec, pos) -> the season a card shows."""
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

    def prime(spec, pos):
        name, _, pin = spec.partition('|')
        mine = [x for x in seasons if norm(x['name']) == norm(name) and x['pos'] == pos]
        if pin and not pin.isdigit():
            ids = {x['id'] for x in mine if era_abbr(x['team'], x['season']) == pin or FRANCHISE.get(x['team'], x['team']) == pin}
            mine = [x for x in mine if x['id'] in ids]
        if not mine:
            raise SystemExit(f'No {pos} {spec} in {FIRST}-{LAST}.')
        if len({x['id'] for x in mine}) > 1:
            raise SystemExit(f'Two {pos}s named {name}: add |TEAM to pick one.')
        if pin.isdigit():
            hit = [x for x in mine if x['season'] == int(pin)]
            if not hit:
                raise SystemExit(f'{name} has no {pin} season.')
            return hit[0]
        return max(mine, key=score)
    prime.score = score
    return prime


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


def schedule(board, cells, base, rating, avg, recs):
    """17 real team-seasons from the board's pool. need = the points per game a lineup must beat to win that game
    (the opponent's points per game, minus how much better than average its defense was). The k-th easiest game sits
    at the TARGET quantile of the board's sensible lineups ($13-$15); the hardest is the best team the perfect lineup
    beats, and it comes last. The rest are dealt into weeks so the hard ones are spread out."""
    pool = {'NFC': set(NFC), 'AFC': set(AFC), 'ALL': set(NFC + AFC)}[board['pool']]
    teams = []
    for (y, f), r in rating.items():
        if f in pool:
            teams.append({'f': f, 'y': y, 'pf': r['pf'], 'pa': r['pa'] - avg[y], 'need': r['pf'] - (r['pa'] - avg[y])})
    all_ppg = sorted(p for p, _, _ in lineups(cells, base))
    sensible = sorted(p for p, c, _ in lineups(cells, base) if c >= BUDGET - 2)
    top = all_ppg[-1]
    mu, sd = TARGET
    targets = []
    for k in range(1, 17):
        q = phi((k - 0.5 - mu) / sd)
        targets.append(sensible[min(len(sensible) - 1, int(q * len(sensible)))])
    chosen, used = [], set()
    # The finale: the best team the perfect lineup still beats.
    boss = max((t for t in teams if round(t['need'], 2) < top - 0.01), key=lambda t: t['need'])
    used.add((boss['y'], boss['f']))
    for tg in targets:
        t = min((t for t in teams if (t['y'], t['f']) not in used and t['need'] < boss['need']), key=lambda t: abs(t['need'] - tg))
        used.add((t['y'], t['f']))
        chosen.append(t)
    chosen.append(boss)
    by = sorted(chosen, key=lambda t: t['need'])
    # Weave easiest, hardest, second easiest... (without the boss), rotated so the season opens mid-pack; boss last.
    by.remove(boss)
    order, lo, hi = [], 0, len(by) - 1
    while lo <= hi:
        order.append(by[lo])
        lo += 1
        if lo <= hi:
            order.append(by[hi])
            hi -= 1
    order = order[2:] + order[:2] + [boss]
    out = []
    for i, t in enumerate(order):
        out.append({'f': t['f'], 'y': t['y'], 't': era_abbr(t['f'], t['y']), 'tn': era_name(t['f'], t['y']),
                    'home': 1 if i % 2 == 0 else 0, 'pf': round(t['pf'], 2), 'pa': round(t['pa'], 2),
                    'need': round(t['need'], 2), 'rec': recs.get((t['y'], t['f']), '')})
    return out


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


def report(board, base):
    ls = sorted(lineups(board['cells'], base), key=lambda x: -x[0])
    dist, sens = {}, {}
    for p, c, _ in ls:
        w = wins(p, board['sched'])
        dist[w] = dist.get(w, 0) + 1
        if c >= BUDGET - 2:
            sens[w] = sens.get(w, 0) + 1
    print(f"\n== {board['name']}: {len(ls)} legal lineups")
    print('  wins, every lineup:   ', dict(sorted(dist.items(), reverse=True)))
    print('  wins, $13-$15 lineups:', dict(sorted(sens.items(), reverse=True)))
    for p, c, pick in ls[:5]:
        names = ', '.join(f"{board['cells'][ci][r]['s']} {board['cells'][ci][r]['y']} (${TIERS[r]})" for ci, r in enumerate(pick))
        print(f"  {p:5.2f} ppg  ${c}  {wins(p, board['sched'])}-{17 - wins(p, board['sched'])}  {names}")
    print('  schedule:', ', '.join(f"{g['y']} {g['t']} {g['rec']} ({g['need']:.1f})" for g in board['sched']))


def main():
    seasons, rep = load_seasons()
    rating, avg = load_games()
    model = fit(seasons, rating)
    players = fetch('players.csv', f'{REL}/players/players.csv')
    heads = {}
    for p in players:
        e = p.get('espn_id') or ''
        if e.endswith('.0'):
            e = e[:-2]
        heads[p['gsis_id']] = {'espn': e if e.isdigit() else '', 'url': p.get('headshot') or ''}
    prime = primes(seasons)

    if len(sys.argv) > 1 and sys.argv[1] == 'who':
        want = {norm(n) for n in sys.argv[2:]}
        best = {}
        for s in seasons:
            if norm(s['name']) in want and (s['id'] not in best or prime.score(s) > prime.score(best[s['id']])):
                best[s['id']] = s
        for s in sorted(seasons, key=lambda s: (s['name'], s['id'], s['season'])):
            if norm(s['name']) in want:
                star = '*' if best[s['id']] is s else ' '
                print(f"{star} {s['name']:<22} {s['season']} {s['pos']} {s['team']:<4} g{int(s['games']):>2}  value {s['value']:6.1f}"
                      f"  imp {model['w'][s['pos']] * s['pg']:5.2f}  {' · '.join(line_of(s))}")
        return

    print(f"model: base {model['base']:.2f}, weights " + ', '.join(f'{k} {v:.3f}' for k, v in model['w'].items())
          + f", R^2 {model['r2']:.3f} over {model['n']} team-seasons; replacement per play "
          + ', '.join(f'{k} {v:+.3f}' for k, v in rep.items()))
    recs = team_records()
    out_boards = []
    for b in BOARDS:
        cells = []
        for ci, names in enumerate(b['cols']):
            col = []
            for n in names:
                c = card(prime(n, COLS[ci]), model['w'], heads)
                if n in SHOW_AS:
                    c['n'], c['s'] = SHOW_AS[n], short(SHOW_AS[n])
                col.append(c)
            cells.append(col)
        sched = schedule(b, cells, model['base'], rating, avg, recs)
        ob = {'id': b['id'], 'name': b['name'], 'sub': b['sub'], 'budget': BUDGET, 'tiers': TIERS, 'cols': LABELS,
              'cells': cells, 'sched': sched}
        report(ob, model['base'])
        out_boards.append(ob)
    for ob in out_boards:
        for col in ob['cells']:
            for c in col:
                if not c['e']:
                    print('  no ESPN id:', c['n'], file=sys.stderr)
    doc = {
        'about': 'Boards and season model for 17-0. Generated by tools/seventeen/build.py from nflverse data '
                 f'(regular seasons {FIRST}-{LAST}); edit the boards there, not here.',
        'asof': f'{LAST} season',
        'model': {'base': model['base'], 'w': model['w'],
                  'r2': round(model['r2'], 3), 'n': model['n'], 'share': RECV_SHARE, 'rep': REP_PCT},
        'colors': COLORS,
        'boards': out_boards,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print('\nwrote', os.path.relpath(OUT, ROOT), f'({os.path.getsize(OUT):,} bytes)')


if __name__ == '__main__':
    main()
