#!/usr/bin/env python3
"""Builds data/dynasty.json for Gridiron Dynasty (js/core/dynasty.js, js/views/dynasty.js): every card in the game, made
from real NFL players. Inputs are nflverse's public releases (rosters, season and weekly player stats, snap counts),
fetched into a cache folder; run: python3 tools/dynasty/build.py [--cache DIR] (then bump CACHE in sw.js).

The series (the owner's ask, Oct 27 2026: cards "based on real life players", the way MLB The Show does its card types
and collections):
  L  Live Series  every active player; OVR from 2025 + 2026 production and snap share, ranked within his position
  R  Rookie       the best 2026 rookies, a rookie-year card a little above their Live one
  P  Prime        the top two or three at each position at their best
  G  Gameday      each week's best real performances (like The Show's Topps Now), the stat line on the card
  A  Awards       the 2025 season's statistical leaders
  X  Legends      the all-time greats (hand-picked below)
Rarity is by OVR: Mythic 85+, Legendary 80-84, Epic 75-79, Rare 65-74, Common 64 and under.
"""
import csv, json, math, os, sys, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'data', 'dynasty.json')
SEASON = 2026
REL = 'https://github.com/nflverse/nflverse-data/releases/download/'
FILES = {
    'roster': f'rosters/roster_{SEASON}.csv',
    'reg_prev': f'stats_player/stats_player_reg_{SEASON - 1}.csv',
    'reg_now': f'stats_player/stats_player_reg_{SEASON}.csv',
    'week_now': f'stats_player/stats_player_week_{SEASON}.csv',
    'snaps_prev': f'snap_counts/snap_counts_{SEASON - 1}.csv',
    'snaps_now': f'snap_counts/snap_counts_{SEASON}.csv',
}

# abbr: name, primary, secondary, conference, division
TEAMS = {
    'ARI': ('Arizona Cardinals', '#97233F', '#FFB612', 'NFC', 'West'), 'ATL': ('Atlanta Falcons', '#A71930', '#101820', 'NFC', 'South'),
    'BAL': ('Baltimore Ravens', '#241773', '#9E7C0C', 'AFC', 'North'), 'BUF': ('Buffalo Bills', '#00338D', '#C60C30', 'AFC', 'East'),
    'CAR': ('Carolina Panthers', '#0085CA', '#101820', 'NFC', 'South'), 'CHI': ('Chicago Bears', '#0B162A', '#C83803', 'NFC', 'North'),
    'CIN': ('Cincinnati Bengals', '#FB4F14', '#000000', 'AFC', 'North'), 'CLE': ('Cleveland Browns', '#311D00', '#FF3C00', 'AFC', 'North'),
    'DAL': ('Dallas Cowboys', '#003594', '#869397', 'NFC', 'East'), 'DEN': ('Denver Broncos', '#FB4F14', '#002244', 'AFC', 'West'),
    'DET': ('Detroit Lions', '#0076B6', '#B0B7BC', 'NFC', 'North'), 'GB': ('Green Bay Packers', '#203731', '#FFB612', 'NFC', 'North'),
    'HOU': ('Houston Texans', '#03202F', '#A71930', 'AFC', 'South'), 'IND': ('Indianapolis Colts', '#002C5F', '#A2AAAD', 'AFC', 'South'),
    'JAX': ('Jacksonville Jaguars', '#006778', '#D7A22A', 'AFC', 'South'), 'KC': ('Kansas City Chiefs', '#E31837', '#FFB81C', 'AFC', 'West'),
    'LA': ('Los Angeles Rams', '#003594', '#FFA300', 'NFC', 'West'), 'LAC': ('Los Angeles Chargers', '#0080C6', '#FFC20E', 'AFC', 'West'),
    'LV': ('Las Vegas Raiders', '#000000', '#A5ACAF', 'AFC', 'West'), 'MIA': ('Miami Dolphins', '#008E97', '#FC4C02', 'AFC', 'East'),
    'MIN': ('Minnesota Vikings', '#4F2683', '#FFC62F', 'NFC', 'North'), 'NE': ('New England Patriots', '#002244', '#C60C30', 'AFC', 'East'),
    'NO': ('New Orleans Saints', '#101820', '#D3BC8D', 'NFC', 'South'), 'NYG': ('New York Giants', '#0B2265', '#A71930', 'NFC', 'East'),
    'NYJ': ('New York Jets', '#125740', '#FFFFFF', 'AFC', 'East'), 'PHI': ('Philadelphia Eagles', '#004C54', '#A5ACAF', 'NFC', 'East'),
    'PIT': ('Pittsburgh Steelers', '#101820', '#FFB612', 'AFC', 'North'), 'SEA': ('Seattle Seahawks', '#002244', '#69BE28', 'NFC', 'West'),
    'SF': ('San Francisco 49ers', '#AA0000', '#B3995D', 'NFC', 'West'), 'TB': ('Tampa Bay Buccaneers', '#D50A0A', '#34302B', 'NFC', 'South'),
    'TEN': ('Tennessee Titans', '#0C2340', '#4B92DB', 'AFC', 'South'), 'WAS': ('Washington Commanders', '#5A1414', '#FFB612', 'NFC', 'East'),
}
ESPN_TEAM = {'LA': 'LAR', 'WAS': 'WSH'}  # nflverse abbr -> ESPN's (logos)

POS = {'QB': 'QB', 'RB': 'RB', 'HB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'T': 'OL', 'G': 'OL', 'C': 'OL', 'OT': 'OL', 'OG': 'OL',
       'OL': 'OL', 'LT': 'OL', 'RT': 'OL', 'LG': 'OL', 'RG': 'OL', 'DE': 'DL', 'DT': 'DL', 'NT': 'DL', 'DL': 'DL', 'OLB': 'LB', 'ILB': 'LB',
       'MLB': 'LB', 'LB': 'LB', 'CB': 'CB', 'DB': 'CB', 'FS': 'S', 'SS': 'S', 'S': 'S', 'SAF': 'S', 'K': 'K', 'PK': 'K'}
# starters a team plays at each position: the rank/OVR curve is laid against 32 teams' worth
STARTERS = {'QB': 1, 'RB': 1.2, 'WR': 2.6, 'TE': 1.2, 'OL': 5, 'DL': 3.5, 'LB': 2.5, 'CB': 2.6, 'S': 2, 'K': 1}
# rank among starters (0 = the best, 1 = the 32nd team's last starter) -> OVR
CURVE = [(0, 97), (0.03, 93), (0.1, 89), (0.22, 85), (0.45, 80), (0.75, 75.5), (1.0, 72), (1.4, 66), (2.0, 60), (3.0, 53), (6.0, 46)]
PRIME_N = {'QB': 2, 'RB': 2, 'WR': 3, 'TE': 2, 'OL': 3, 'DL': 3, 'LB': 2, 'CB': 2, 'S': 2, 'K': 1}


def fetch(cache):
    os.makedirs(cache, exist_ok=True)
    out = {}
    for k, path in FILES.items():
        f = os.path.join(cache, os.path.basename(path))
        if not os.path.exists(f):
            print('fetch', path, file=sys.stderr)
            urllib.request.urlretrieve(REL + path, f)
        with open(f, newline='', encoding='utf-8') as fh:
            out[k] = list(csv.DictReader(fh))
    return out


def num(x):
    try:
        return float(x) if x not in (None, '', 'NA') else 0.0
    except ValueError:
        return 0.0


def curve(x):
    for (x0, y0), (x1, y1) in zip(CURVE, CURVE[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return CURVE[-1][1]


def rarity(ovr):
    return 'mythic' if ovr >= 85 else 'legendary' if ovr >= 80 else 'epic' if ovr >= 75 else 'rare' if ovr >= 65 else 'common'


def def_score(s, pos=''):
    if pos in ('CB', 'S'):
        return (0.6 * num(s['def_tackles_solo']) + 0.3 * num(s['def_tackle_assists']) + num(s['def_tackles_for_loss'])
                + 2 * num(s['def_sacks']) + 8 * num(s['def_interceptions']) + 3.5 * num(s['def_pass_defended'])
                + 4 * num(s['def_fumbles_forced']) + 6 * num(s['def_tds']))
    return (num(s['def_tackles_solo']) + 0.5 * num(s['def_tackle_assists']) + 2 * num(s['def_tackles_for_loss'])
            + 4 * num(s['def_sacks']) + 1.5 * num(s['def_qb_hits']) + 6 * num(s['def_interceptions'])
            + 2.5 * num(s['def_pass_defended']) + 4 * num(s['def_fumbles_forced']) + 6 * num(s['def_tds']))


def prod(pos, s):
    """A season's (or a game's) production, in one number, for ranking within a position."""
    if pos == 'QB':
        return num(s['fantasy_points']) + 0.5 * num(s['passing_epa']) + 0.3 * num(s['rushing_epa'])
    if pos in ('RB', 'WR', 'TE'):
        return num(s['fantasy_points_ppr'])
    if pos == 'K':
        return 3 * num(s['fg_made']) + num(s['pat_made']) + 2 * num(s['fg_made_50_59']) - 1.5 * num(s['fg_missed'])
    if pos in ('DL', 'LB', 'CB', 'S'):
        return def_score(s, pos)
    return 0.0


def pct_rank(vals):
    """value -> 0..1 percentile (higher better) among vals; ties share the middle of their run."""
    import bisect
    v = sorted(vals)
    n = len(v)
    def f(x):
        if n <= 1:
            return 0.5
        lo, hi = bisect.bisect_left(v, x), bisect.bisect_right(v, x)
        return min(1.0, ((lo + hi - 1) / 2) / (n - 1))
    return f


def fmt(n):
    return f'{int(round(n)):,}'


def line(pos, s):
    """The card's stat line for a season (or a game)."""
    if not s:
        return ''
    g = []
    if pos == 'QB':
        g = [f"{fmt(num(s['passing_yards']))} YDS", f"{int(num(s['passing_tds']))} TD", f"{int(num(s['passing_interceptions']))} INT"]
        if num(s['rushing_yards']) >= 100:
            g.append(f"{fmt(num(s['rushing_yards']))} RUSH")
    elif pos == 'RB':
        g = [f"{fmt(num(s['rushing_yards']))} RUSH", f"{int(num(s['rushing_tds']) + num(s['receiving_tds']))} TD", f"{int(num(s['receptions']))} REC"]
    elif pos in ('WR', 'TE'):
        g = [f"{int(num(s['receptions']))} REC", f"{fmt(num(s['receiving_yards']))} YDS", f"{int(num(s['receiving_tds']))} TD"]
    elif pos == 'K':
        g = [f"{int(num(s['fg_made']))}/{int(num(s['fg_att']))} FG", f"LONG {int(num(s['fg_long']))}"]
    elif pos in ('DL', 'LB', 'CB', 'S'):
        t = num(s['def_tackles_solo']) + num(s['def_tackle_assists'])
        g = [f"{int(t)} TKL"]
        if num(s['def_sacks']):
            g.append(f"{num(s['def_sacks']):g} SCK")
        if num(s['def_interceptions']):
            g.append(f"{int(num(s['def_interceptions']))} INT")
        if num(s['def_pass_defended']) and len(g) < 3:
            g.append(f"{int(num(s['def_pass_defended']))} PD")
        if num(s['def_tackles_for_loss']) and len(g) < 3:
            g.append(f"{int(num(s['def_tackles_for_loss']))} TFL")
    return ' · '.join(g)


# The card's attributes: (code, label, value from a season's stats per game, already a rate), per position
def attrs_of(pos, s, g, snaps):
    gg = max(1.0, g)
    if pos == 'QB':
        att = max(1.0, num(s['attempts']))
        return {'ARM': num(s['passing_yards']) / att + num(s['passing_air_yards']) / att * 0.3,
                'ACC': num(s['completions']) / att,
                'IQ': (num(s['passing_tds']) + 1) / (num(s['passing_interceptions']) + 1) + num(s['passing_epa']) / att * 10,
                'RUN': num(s['rushing_yards']) / gg}
    if pos == 'RB':
        car = max(1.0, num(s['carries']))
        return {'RUN': num(s['rushing_yards']) / gg, 'BRK': (num(s['rushing_10']) + 2 * num(s['rushing_20'])) / car + num(s['rushing_yards']) / car / 10,
                'REC': num(s['receiving_yards']) / gg, 'TD': (num(s['rushing_tds']) + num(s['receiving_tds'])) / gg}
    if pos in ('WR', 'TE'):
        tg = max(1.0, num(s['targets'])); rec = max(1.0, num(s['receptions']))
        return {'CTH': num(s['receptions']) / tg, 'RTE': num(s['targets']) / gg, 'YAC': num(s['receiving_yards_after_catch']) / rec,
                'DEEP': (num(s['receiving_20']) + 2 * num(s['receiving_40'])) / gg + num(s['receiving_air_yards']) / tg / 20}
    if pos == 'K':
        fa = max(1.0, num(s['fg_att']))
        return {'ACC': num(s['fg_made']) / fa, 'PWR': num(s['fg_long']) + 4 * num(s['fg_made_50_59']) + 8 * num(s['fg_made_60_']),
                'CLU': num(s['pat_made']) / max(1.0, num(s['pat_att']))}
    if pos in ('DL', 'LB', 'CB', 'S'):
        return {'PRS': (num(s['def_sacks']) * 2 + num(s['def_qb_hits'])) / gg,
                'TKL': (num(s['def_tackles_solo']) + 0.5 * num(s['def_tackle_assists'])) / gg + num(s['def_tackles_for_loss']) / gg,
                'COV': (num(s['def_pass_defended']) + 3 * num(s['def_interceptions'])) / gg}
    return {}


ATTR_KEYS = {'QB': ['ARM', 'ACC', 'IQ', 'RUN'], 'RB': ['RUN', 'BRK', 'REC', 'TD'], 'WR': ['CTH', 'RTE', 'YAC', 'DEEP'],
             'TE': ['CTH', 'RTE', 'YAC', 'DEEP'], 'K': ['ACC', 'PWR', 'CLU'], 'DL': ['PRS', 'TKL', 'COV'], 'LB': ['TKL', 'PRS', 'COV'],
             'CB': ['COV', 'TKL', 'PRS'], 'S': ['COV', 'TKL', 'PRS'], 'OL': ['PBK', 'RBK', 'DUR']}

# The Legends (hand-picked): name, position, team, era, OVR, number
LEGENDS = [
    ('Tom Brady', 'QB', 'NE', '2000–22', 99, 12), ('Jerry Rice', 'WR', 'SF', '1985–2004', 99, 80), ('Lawrence Taylor', 'LB', 'NYG', '1981–93', 99, 56),
    ('Barry Sanders', 'RB', 'DET', '1989–98', 98, 20), ('Peyton Manning', 'QB', 'IND', '1998–2015', 98, 18), ('Reggie White', 'DL', 'PHI', '1985–2000', 98, 92),
    ('Jim Brown', 'RB', 'CLE', '1957–65', 98, 32), ('Joe Montana', 'QB', 'SF', '1979–94', 97, 16), ('Deion Sanders', 'CB', 'DAL', '1989–2005', 97, 21),
    ('Walter Payton', 'RB', 'CHI', '1975–87', 97, 34), ('Randy Moss', 'WR', 'MIN', '1998–2012', 97, 84), ('Aaron Donald', 'DL', 'LA', '2014–23', 97, 99),
    ('Ray Lewis', 'LB', 'BAL', '1996–2012', 97, 52), ('Anthony Muñoz', 'OL', 'CIN', '1980–92', 96, 78), ('Ed Reed', 'S', 'BAL', '2002–13', 96, 20),
    ('Ronnie Lott', 'S', 'SF', '1981–94', 96, 42), ('Dan Marino', 'QB', 'MIA', '1983–99', 96, 13), ('Calvin Johnson', 'WR', 'DET', '2007–15', 96, 81),
    ('Rob Gronkowski', 'TE', 'NE', '2010–21', 96, 87), ('Tony Gonzalez', 'TE', 'KC', '1997–2013', 95, 88), ('LaDainian Tomlinson', 'RB', 'LAC', '2001–11', 96, 21),
    ('J.J. Watt', 'DL', 'HOU', '2011–22', 95, 99), ('Bruce Smith', 'DL', 'BUF', '1985–2003', 95, 78), ('Darrelle Revis', 'CB', 'NYJ', '2007–17', 95, 24),
    ('Champ Bailey', 'CB', 'DEN', '1999–2013', 94, 24), ('Troy Polamalu', 'S', 'PIT', '2003–14', 95, 43), ('Dick Butkus', 'LB', 'CHI', '1965–73', 96, 51),
    ('Derrick Thomas', 'LB', 'KC', '1989–99', 94, 58), ('Brian Urlacher', 'LB', 'CHI', '2000–12', 93, 54), ('Emmitt Smith', 'RB', 'DAL', '1990–2004', 95, 22),
    ('Adrian Peterson', 'RB', 'MIN', '2007–21', 94, 28), ('Marshall Faulk', 'RB', 'LA', '1994–2005', 94, 28), ('Terrell Owens', 'WR', 'SF', '1996–2010', 94, 81),
    ('John Elway', 'QB', 'DEN', '1983–98', 95, 7), ('Brett Favre', 'QB', 'GB', '1991–2010', 95, 4), ('Drew Brees', 'QB', 'NO', '2001–20', 95, 9),
    ('Larry Allen', 'OL', 'DAL', '1994–2007', 95, 73), ('Jonathan Ogden', 'OL', 'BAL', '1996–2007', 95, 75), ('Joe Thomas', 'OL', 'CLE', '2007–17', 94, 73),
    ('Charles Woodson', 'CB', 'LV', '1998–2015', 94, 24), ('Rod Woodson', 'CB', 'PIT', '1987–2003', 94, 26), ('Adam Vinatieri', 'K', 'NE', '1996–2019', 95, 4),
    ('Justin Tucker', 'K', 'BAL', '2012–24', 93, 9), ('Junior Seau', 'LB', 'LAC', '1990–2009', 94, 55), ('Michael Strahan', 'DL', 'NYG', '1993–2007', 94, 92),
]

# The 2025 awards: (id, title, position group filter, stat key, ovr)
AWARDS = [
    ('pass-yds', 'Passing Yards Leader', ('QB',), 'passing_yards', 95), ('pass-td', 'Passing TD Leader', ('QB',), 'passing_tds', 94),
    ('rush-yds', 'Rushing Yards Leader', ('RB', 'QB', 'WR'), 'rushing_yards', 95), ('rush-td', 'Rushing TD Leader', ('RB', 'QB', 'WR', 'TE'), 'rushing_tds', 93),
    ('rec-yds', 'Receiving Yards Leader', ('WR', 'TE', 'RB'), 'receiving_yards', 95), ('rec', 'Receptions Leader', ('WR', 'TE', 'RB'), 'receptions', 93),
    ('rec-td', 'Receiving TD Leader', ('WR', 'TE', 'RB'), 'receiving_tds', 93), ('te-yds', 'Top Tight End', ('TE',), 'receiving_yards', 92),
    ('sacks', 'Sack Leader', ('DL', 'LB'), 'def_sacks', 95), ('ints', 'Interception Leader', ('CB', 'S', 'LB'), 'def_interceptions', 94),
    ('tkl', 'Tackle Leader', ('LB', 'S', 'CB', 'DL'), 'tackles', 92), ('pd', 'Passes Defended Leader', ('CB', 'S'), 'def_pass_defended', 92),
    ('tfl', 'Tackles for Loss Leader', ('DL', 'LB'), 'def_tackles_for_loss', 92), ('fg', 'Field Goals Leader', ('K',), 'fg_made', 92),
    ('scrim', 'Scrimmage Yards Leader', ('RB', 'WR', 'TE'), 'scrimmage', 94),
]


def main():
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else os.path.join(ROOT, 'tools', 'dynasty', '.cache')
    D = fetch(cache)
    # (each team's latest weekly roster: a team on its bye week has none for the latest week; a player listed twice, his
    # latest row)
    last = {}
    for r in D['roster']:
        if r['week']:
            last[r['team']] = max(last.get(r['team'], 0), int(r['week']))
    seen = {}
    for r in D['roster']:
        if r['week'] and int(r['week']) == last.get(r['team']):
            was = seen.get(r['gsis_id'])
            if not was or int(r['week']) >= int(was['week']):
                seen[r['gsis_id']] = r
    roster = [r for r in seen.values() if r['status'] == 'ACT']
    prev = {s['player_id']: s for s in D['reg_prev']}
    now = {s['player_id']: s for s in D['reg_now']}
    for s in list(prev.values()) + list(now.values()):
        s['tackles'] = num(s['def_tackles_solo']) + num(s['def_tackle_assists'])
        s['scrimmage'] = num(s['rushing_yards']) + num(s['receiving_yards'])

    def snap_of(rows):
        acc = {}
        for r in rows:
            if r['game_type'] != 'REG':
                continue
            pct = max(num(r['offense_pct']), num(r['defense_pct']))
            a = acc.setdefault(r['pfr_player_id'], [0, 0.0])
            a[0] += 1
            a[1] += pct
        return acc
    sp, sn = snap_of(D['snaps_prev']), snap_of(D['snaps_now'])
    # (the offensive line: no stats of its own, so its team's: how rarely the passer was sacked, how far the backs ran)
    line_q = {}
    for rows, w in ((D['reg_prev'], 0.6), (D['reg_now'], 1.0)):
        acc = {}
        for s in rows:
            t = acc.setdefault(s['recent_team'], [0.0, 0.0, 0.0, 0.0])
            t[0] += num(s['sacks_suffered']); t[1] += num(s['attempts']) + num(s['sacks_suffered'])
            if s['position'] == 'RB':
                t[2] += num(s['rushing_yards']); t[3] += num(s['carries'])
        for k, t in acc.items():
            q = line_q.setdefault(k, [0.0, 0.0, 0.0])
            q[0] += w * (1 - t[0] / max(1.0, t[1])); q[1] += w * (t[2] / max(1.0, t[3])); q[2] += w
    pb_rank = pct_rank([q[0] / q[2] for q in line_q.values()])
    rb_rank = pct_rank([q[1] / q[2] for q in line_q.values()])
    LINE = {k: (pb_rank(q[0] / q[2]), rb_rank(q[1] / q[2])) for k, q in line_q.items()}
    team_games = max(int(r['week']) for r in D['week_now'] if r['season_type'] == 'REG')

    players = []
    for r in roster:
        pos = POS.get(r['depth_chart_position']) or POS.get(r['position'])
        if not pos or r['team'] not in TEAMS:
            continue
        a, b = prev.get(r['gsis_id']), now.get(r['gsis_id'])
        ga, gb = (num(a['games']) if a else 0), (num(b['games']) if b else 0)
        pa, pb = sp.get(r['pfr_id'], [0, 0]), sn.get(r['pfr_id'], [0, 0])
        # per game, the season now counting more than last (and a full season at most as much as 1.5 of this one's games)
        wa, wb = 0.6, 1.0
        per_a = prod(pos, a) / ga if a and ga else 0.0
        per_b = prod(pos, b) / gb if b and gb else 0.0
        wsum = wa * ga + wb * gb
        per = (wa * ga * per_a + wb * gb * per_b) / wsum if wsum else 0.0
        # (playing time: snap share over the games his team played; few games shrink it)
        snap_g = pa[0] * 0.6 + pb[0]
        snap_avg = (pa[1] * 0.6 + pb[1]) / snap_g if snap_g else 0.0
        avail = min(1.0, (wa * ga + wb * gb) / (wa * 17 + wb * team_games) * 1.6)
        if pos == 'OL':
            pbq, rbq = LINE.get(r['team'], (0.5, 0.5))
            dn0 = int(num(r['draft_number'])) if r['draft_number'] else 300
            ped = 1.0 if dn0 <= 15 else 0.8 if dn0 <= 40 else 0.6 if dn0 <= 100 else 0.4 if dn0 <= 200 else 0.25
            score = snap_avg * 100 * (0.35 + 0.65 * min(1.0, (pa[0] * 0.6 + pb[0]) / (0.6 * 17 + team_games))) \
                * (0.7 + 0.18 * pbq + 0.12 * rbq) * (0.85 + 0.15 * ped)
        elif pos == 'K':
            score = per * (0.5 + 0.5 * avail)
        else:
            score = per * (0.55 + 0.45 * snap_avg) * (0.6 + 0.4 * avail)
        dn = int(num(r['draft_number'])) if r['draft_number'] else 0
        players.append({'r': r, 'pos': pos, 'a': a, 'b': b, 'ga': ga, 'gb': gb, 'score': score, 'snap': snap_avg,
                        'snapg': pa[0] + pb[0], 'draft': dn})

    by_pos = {}
    for p in players:
        by_pos.setdefault(p['pos'], []).append(p)
    for pos, lst in by_pos.items():
        lst.sort(key=lambda p: -p['score'])
        T = STARTERS[pos] * 32
        for i, p in enumerate(lst):
            ovr = curve(i / T)
            # (a rookie drafted high but not yet playing much: a floor from where he was picked)
            rookie = p['r']['rookie_year'] == str(SEASON)
            if p['draft'] and (rookie or p['score'] == 0):
                floor = 74 if p['draft'] <= 10 else 70 if p['draft'] <= 32 else 66 if p['draft'] <= 64 else 60 if p['draft'] <= 120 else 0
                ovr = max(ovr, floor)
            p['ovr'] = int(round(min(99, max(40, ovr))))
        # attributes: percentiles within the position (players with real stats), 40..99
        keys = ATTR_KEYS[pos]
        raw = []
        for p in lst:
            s = p['b'] if p['b'] and p['gb'] >= 3 else p['a'] if p['a'] else p['b']
            g = p['gb'] if s is p['b'] else p['ga']
            if pos == 'OL':
                pbq, rbq = LINE.get(p['r']['team'], (0.5, 0.5))
                v = {'PBK': pbq + 0.4 * p['snap'], 'RBK': rbq + 0.4 * p['snap'], 'DUR': p['snapg'] * (0.5 + p['snap'])}
            else:
                v = attrs_of(pos, s, g, p['snap']) if s else {}
            raw.append(v)
        ranks = {k: pct_rank([v[k] for v in raw if k in v]) for k in keys}
        for p, v in zip(lst, raw):
            out = []
            for k in keys:
                if k in v:
                    q = ranks[k](v[k])
                    # (pulled toward the card's OVR so a 95 doesn't show three 50s, nor a 55 a 99)
                    out.append(int(round(max(35, min(99, 0.55 * (40 + 59 * q) + 0.45 * p['ovr'])))))
                else:
                    out.append(max(35, p['ovr'] - 12))
            p['attrs'] = out

    def head_of(r):
        if r.get('espn_id'):
            return r['espn_id']
        u = r.get('headshot_url') or ''
        return 'n:' + u.rsplit('/', 1)[-1] if u else ''

    cards, P = [], {}
    pid = {}
    for p in players:
        r = p['r']
        key = r['gsis_id'].replace('00-', '')
        pid[r['gsis_id']] = key
        h = head_of(r)
        P[key] = [r['full_name'], r['team'], p['pos'], int(num(r['jersey_number'])) if r['jersey_number'] else 0, h,
                  int(num(r['years_exp'])), r['college'].split(';')[0], p['draft']]
        lines = [line(p['pos'], p['b']) if p['b'] else '', line(p['pos'], p['a']) if p['a'] else '']
        cards.append({'id': 'L' + key, 's': 'L', 'p': key, 'o': p['ovr'], 'a': p['attrs'], 'ln': lines})
        p['key'] = key

    # Rookies: the best 2026 rookies, their rookie-year card a little above the Live one
    rook = sorted([p for p in players if p['r']['rookie_year'] == str(SEASON)], key=lambda p: (-p['ovr'], -p['score']))[:36]
    for p in rook:
        o = min(97, max(72, p['ovr'] + 3))
        cards.append({'id': 'R' + p['key'], 's': 'R', 'p': p['key'], 'o': o, 'a': [min(99, x + 3) for x in p['attrs']],
                      'ln': [line(p['pos'], p['b']) if p['b'] else 'Rookie season', ''], 't': f"{SEASON} Rookie · Pick {p['draft']}" if p['draft'] else f'{SEASON} Rookie'})

    # Prime: the best at each position at his best
    for pos, lst in by_pos.items():
        for p in lst[:PRIME_N[pos]]:
            o = min(99, max(90, p['ovr'] + 2))
            cards.append({'id': 'P' + p['key'], 's': 'P', 'p': p['key'], 'o': o, 'a': [min(99, x + 4) for x in p['attrs']],
                          'ln': [line(p['pos'], p['b']) if p['b'] else '', line(p['pos'], p['a']) if p['a'] else ''], 't': f'Prime · No. {lst.index(p) + 1} {pos}'})

    # Gameday: each week's best real performances
    live = {p['r']['gsis_id']: p for p in players}
    wk_rows = [s for s in D['week_now'] if s['season_type'] == 'REG']
    weeks = sorted(set(int(s['week']) for s in wk_rows))
    for w in weeks:
        rows = [s for s in wk_rows if int(s['week']) == w and s['player_id'] in live]
        off, de = [], []
        for s in rows:
            p = live[s['player_id']]
            if p['pos'] in ('QB', 'RB', 'WR', 'TE'):
                v = num(s['fantasy_points_ppr']) - (6 if p['pos'] == 'QB' else 0)
                off.append((v, s, p))
            elif p['pos'] in ('DL', 'LB', 'CB', 'S'):
                de.append((def_score(s, p['pos']), s, p))
        off.sort(key=lambda x: -x[0]); de.sort(key=lambda x: -x[0])
        picks, qbs = [], 0
        for v, s, p in off:
            if len(picks) >= 6:
                break
            if p['pos'] == 'QB':
                if qbs >= 2:
                    continue
                qbs += 1
            picks.append((v, s, p))
        picks += de[:3]
        for rank, (v, s, p) in enumerate(picks):
            o = int(min(96, max(86, p['ovr'] + 2 + (1 if rank == 0 else 0))))
            opp = s.get('opponent_team', '')
            cards.append({'id': f"G{w}-{p['key']}", 's': 'G', 'p': p['key'], 'o': o, 'a': [min(99, x + 5) for x in p['attrs']],
                          'ln': [line(p['pos'], s), ''], 't': f"Week {w} vs {opp}", 'w': w, 'tm': s['team']})

    # Awards: the 2025 leaders (still active, or at least on a 2026 roster)
    for aid, title, pos_ok, stat, ovr in AWARDS:
        best = None
        for gs, s in prev.items():
            p = live.get(gs)
            if not p or p['pos'] not in pos_ok:
                continue
            v = num(s[stat]) if stat in s else 0
            if not best or v > best[0]:
                best = (v, s, p)
        if not best or best[0] <= 0:
            continue
        v, s, p = best
        val = f'{v:g}' if stat == 'def_sacks' else fmt(v)
        unit = {'passing_yards': 'YDS', 'passing_tds': 'TD', 'rushing_yards': 'YDS', 'rushing_tds': 'TD', 'receiving_yards': 'YDS',
                'receptions': 'REC', 'receiving_tds': 'TD', 'def_sacks': 'SACKS', 'def_interceptions': 'INT', 'tackles': 'TKL',
                'def_pass_defended': 'PD', 'def_tackles_for_loss': 'TFL', 'fg_made': 'FG', 'scrimmage': 'YDS'}[stat]
        o = max(ovr, min(97, p['ovr'] + 2))
        cards.append({'id': f"A-{aid}", 's': 'A', 'p': p['key'], 'o': o, 'a': [min(99, x + 5) for x in p['attrs']],
                      'ln': [f'{val} {unit} in {SEASON - 1}', line(p['pos'], s)], 't': f'{SEASON - 1} {title}', 'tm': s['recent_team']})

    # Legends
    for i, (name, pos, team, era, ovr, jersey) in enumerate(LEGENDS):
        key = 'x' + ''.join(c for c in name.lower() if c.isalnum())[:14]
        P[key] = [name, team, pos, jersey, '', 0, '', 0]
        base = [ovr - 1, ovr - 3, ovr - 6, ovr - 9][:len(ATTR_KEYS[pos])]
        cards.append({'id': 'X' + key[1:], 's': 'X', 'p': key, 'o': ovr, 'a': base, 'ln': [era, ''], 't': f'Legend · {era}'})

    for c in cards:
        c['r'] = rarity(c['o'])
    order = {'X': 0, 'P': 1, 'A': 2, 'G': 3, 'R': 4, 'L': 5}
    cards.sort(key=lambda c: (order[c['s']], -c['o'], P[c['p']][0]))
    out = {
        'about': 'Gridiron Dynasty cards: real NFL players from nflverse (rosters, 2025 and 2026 regular-season stats, snap counts). '
                 'Built by tools/dynasty/build.py.',
        'v': 1, 'season': SEASON, 'asof': f'{SEASON} week {max(weeks) if weeks else 0}', 'built': datetime.date.today().isoformat(),
        'teams': {k: [v[0], v[1], v[2], v[3], v[4], ESPN_TEAM.get(k, k)] for k, v in TEAMS.items()},
        'attrs': ATTR_KEYS,
        'players': P,
        'cards': [[c['id'], c['s'], c['p'], c['o'], c['a'], c['ln'], c.get('t', ''), c.get('tm', ''), c.get('w', 0)] for c in cards],
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print('cards', len(cards), Counter(c['s'] for c in cards), Counter(c['r'] for c in cards if c['s'] == 'L'), os.path.getsize(OUT), file=sys.stderr)


if __name__ == '__main__':
    main()
