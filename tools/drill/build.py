#!/usr/bin/env python3
"""Two-Minute Drill data: every NFL team's starters with a rating, and one drive a day.

Run: python3 tools/drill/build.py  (standard library only; then bump CACHE in sw.js). It downloads nflverse's data
into CACHE (env DRILL_CACHE, default ~/.cache/gridiron-drill; delete it to pull fresh depth charts), writes
data/drill.json, then runs tools/drill/tune.mjs (node), which sets each day's situation with the game's own engine
(js/core/drill-sim.js).

THE STARTERS. ESPN's depth charts as nflverse saved them last (depth_charts/depth_charts_2026.csv, the newest
snapshot per team), so injuries and benchings are in: on offense the 3WR 1TE set (QB, RB, the top three WRs, TE and
the five linemen), on defense the base front plus the nickel back. Jersey numbers come from the weekly rosters.

THE RATINGS (55-99). Each player's number is where he ranks among the league's starters at his spot, from 2025's
regular season and 2026 so far (2026 counts 1.5x), shrunk toward a below-average prior by how much he has played,
so a rookie or a backup starts near the bottom until he has a body of work:
  QB   EPA per play (passes, sacks and runs) and completion % over expected.
  RB   yards and EPA per touch (carries and targets).
  WR/TE  EPA and yards per target, plus target share.
  OL   no individual stats exist: the team's line (sack rate allowed and yards per carry) with a small nudge for
       draft pedigree, so the five differ a little.
  DL/edge  sacks, QB hits, tackles for loss and pressures per game.
  LB   tackles, tackles for loss, passes defensed and interceptions per game, and passer rating allowed.
  CB/S passer rating allowed and yards per target in coverage (pro-football-reference via nflverse), plus
       interceptions and passes defensed.
  K    field goal % (shrunk toward 82%) with a bonus for 50+ makes.

THE DAYS. Day 1 is START. Each day takes a real game from that NFL week's schedule (Thursday, Sunday night and
Monday night take their own night's game, the other days the week's closest spreads), and you play the team that
needs the drive: the underdog most days. After week 18, random pairs. The situation (score, clock, ball, timeouts)
is tune.mjs's.
"""
import csv, json, os, random, subprocess, sys, urllib.request
from datetime import date, timedelta

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'data', 'drill.json')
CACHE = os.environ.get('DRILL_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', 'gridiron-drill')
REL = 'https://github.com/nflverse/nflverse-data/releases/download'
SEASON = 2026
START = date(2026, 10, 15)
DAYS = 150

# nflverse codes -> the app's (ESPN's), as in tools/seventeen/build.py.
FRANCHISE = {'LA': 'LAR', 'WAS': 'WSH', 'OAK': 'LV', 'SD': 'LAC', 'STL': 'LAR'}
NAMES = {
    'ARI': 'Cardinals', 'ATL': 'Falcons', 'BAL': 'Ravens', 'BUF': 'Bills', 'CAR': 'Panthers', 'CHI': 'Bears', 'CIN': 'Bengals',
    'CLE': 'Browns', 'DAL': 'Cowboys', 'DEN': 'Broncos', 'DET': 'Lions', 'GB': 'Packers', 'HOU': 'Texans', 'IND': 'Colts',
    'JAX': 'Jaguars', 'KC': 'Chiefs', 'LV': 'Raiders', 'LAC': 'Chargers', 'LAR': 'Rams', 'MIA': 'Dolphins', 'MIN': 'Vikings',
    'NE': 'Patriots', 'NO': 'Saints', 'NYG': 'Giants', 'NYJ': 'Jets', 'PHI': 'Eagles', 'PIT': 'Steelers', 'SF': '49ers',
    'SEA': 'Seahawks', 'TB': 'Buccaneers', 'TEN': 'Titans', 'WSH': 'Commanders',
}
CITY = {
    'ARI': 'Arizona', 'ATL': 'Atlanta', 'BAL': 'Baltimore', 'BUF': 'Buffalo', 'CAR': 'Carolina', 'CHI': 'Chicago', 'CIN': 'Cincinnati',
    'CLE': 'Cleveland', 'DAL': 'Dallas', 'DEN': 'Denver', 'DET': 'Detroit', 'GB': 'Green Bay', 'HOU': 'Houston', 'IND': 'Indianapolis',
    'JAX': 'Jacksonville', 'KC': 'Kansas City', 'LV': 'Las Vegas', 'LAC': 'Los Angeles', 'LAR': 'Los Angeles', 'MIA': 'Miami',
    'MIN': 'Minnesota', 'NE': 'New England', 'NO': 'New Orleans', 'NYG': 'New York', 'NYJ': 'New York', 'PHI': 'Philadelphia',
    'PIT': 'Pittsburgh', 'SF': 'San Francisco', 'SEA': 'Seattle', 'TB': 'Tampa Bay', 'TEN': 'Tennessee', 'WSH': 'Washington',
}
code = lambda t: FRANCHISE.get(t, t)

# The offense in 3WR 1TE, in this order; the defense's base front by scheme, then the nickel back.
OFF = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'LT', 'LG', 'C', 'RG', 'RT']
DEF = {
    '43': ['LDE', 'LDT', 'RDT', 'RDE', 'WLB', 'MLB', 'SLB', 'LCB', 'RCB', 'SS', 'FS', 'NB'],
    '34': ['LDE', 'NT', 'RDE', 'WLB', 'LILB', 'RILB', 'SLB', 'LCB', 'RCB', 'SS', 'FS', 'NB'],
}
# What a slot is called on screen and how it is rated.
LABEL = {'LDE': 'DE', 'RDE': 'DE', 'LDT': 'DT', 'RDT': 'DT', 'NT': 'NT', 'MLB': 'LB', 'LILB': 'LB', 'RILB': 'LB',
         'LCB': 'CB', 'RCB': 'CB', 'SS': 'S', 'FS': 'S', 'NB': 'NB', 'WR1': 'WR', 'WR2': 'WR', 'WR3': 'WR',
         'LT': 'OT', 'RT': 'OT', 'LG': 'OG', 'RG': 'OG', 'C': 'C', 'QB': 'QB', 'RB': 'RB', 'TE': 'TE'}


def fetch(name, url):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print('downloading', url, file=sys.stderr)
        with urllib.request.urlopen(url, timeout=300) as r:
            body = r.read()
        with open(path, 'wb') as f:
            f.write(body)
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def fnum(v):
    try:
        x = float(v)
        return 0.0 if x != x else x
    except (TypeError, ValueError):
        return 0.0


# ------------------------------------------------------------------ Starters
# When a spot's own depth is empty (a blank name) or its man already starts elsewhere (a safety listed at nickel too),
# the next man at these spots, in order.
FALLBACK = {
    'NT': ['LDT', 'RDT', 'LDE', 'RDE'], 'LDT': ['RDT', 'NT', 'LDE'], 'RDT': ['LDT', 'NT', 'RDE'],
    'LDE': ['RDE', 'LDT', 'WLB'], 'RDE': ['LDE', 'RDT', 'SLB'],
    'WLB': ['SLB', 'MLB', 'LILB', 'RILB'], 'SLB': ['WLB', 'MLB', 'LILB', 'RILB'], 'MLB': ['WLB', 'SLB', 'LILB', 'RILB'],
    'LILB': ['RILB', 'WLB', 'SLB'], 'RILB': ['LILB', 'WLB', 'SLB'],
    'LCB': ['RCB', 'NB'], 'RCB': ['LCB', 'NB'], 'NB': ['LCB', 'RCB', 'SS', 'FS'], 'SS': ['FS', 'NB'], 'FS': ['SS', 'NB'],
    'LT': ['RT', 'LG'], 'RT': ['LT', 'RG'], 'LG': ['RG', 'C'], 'RG': ['LG', 'C'], 'C': ['LG', 'RG'],
    'QB': [], 'RB': [], 'TE': [],
}


def starters():
    rows = fetch('depth_charts_%d.csv' % SEASON, f'{REL}/depth_charts/depth_charts_{SEASON}.csv')
    latest = {}
    for r in rows:
        latest[r['team']] = max(latest.get(r['team'], ''), r['dt'])
    asof = max(latest.values())[:10]
    depth = {}  # team -> {'off': {pos: [(rank, p)]}, 'def': {...}, 'wr': [...], 'k': [...], 'scheme'}
    for r in rows:
        if r['dt'] != latest[r['team']] or (r['pos_grp'] == 'Special Teams' and r['pos_abb'] != 'PK'):
            continue
        if not r['player_name'].strip() or not r['gsis_id']:
            continue
        t = depth.setdefault(code(r['team']), {'off': {}, 'def': {}, 'wr': [], 'k': [], 'scheme': None})
        rank = int(r['pos_rank'] or 99)
        p = {'n': r['player_name'].strip(), 'g': r['gsis_id'], 'e': r['espn_id']}
        if r['pos_grp'] == 'Special Teams':
            t['k'].append((rank, p))
        elif r['pos_grp'] == '3WR 1TE':
            if r['pos_abb'] == 'WR':
                t['wr'].append((rank, p))
            else:
                t['off'].setdefault(r['pos_abb'], []).append((rank, p))
        elif r['pos_grp'].startswith('Base'):
            t['scheme'] = '34' if '3-4' in r['pos_grp'] else '43'
            t['def'].setdefault(r['pos_abb'], []).append((rank, p))
    teams = {}
    for k, t in depth.items():
        slots, used = {}, set()

        def take(side, pos):
            for cand in [pos] + FALLBACK.get(pos, []):
                for _, p in sorted(t[side].get(cand, []), key=lambda x: x[0]):
                    if p['g'] not in used:
                        used.add(p['g'])
                        return p
            return None
        for i, (_, p) in enumerate(sorted(t['wr'], key=lambda x: x[0])[:3]):
            slots['WR%d' % (i + 1)] = p
            used.add(p['g'])
        for pos in OFF:
            if pos not in slots:
                slots[pos] = take('off', pos)
        for pos in DEF[t['scheme']]:
            slots[pos] = take('def', pos)
        miss = [s for s in OFF + DEF[t['scheme']] if not slots.get(s)]
        kick = sorted(t['k'], key=lambda x: x[0])
        if miss or not kick:
            sys.exit(f'{k}: no starter at {miss or "PK"}')
        teams[k] = {'slots': slots, 'scheme': t['scheme'], 'k': kick[0][1]}
    if len(teams) != 32:
        sys.exit(f'{len(teams)} teams in the depth charts')
    return teams, asof


# ------------------------------------------------------------------ Stats
def stat_table():
    """gsis id -> summed regular-season stats (2025, plus 2026 x1.5) and games."""
    acc = {}

    def add(r, w, games):
        a = acc.setdefault(r['player_id'], {'games': 0.0})
        a['games'] += games * w
        for k, v in r.items():
            if k in ('player_id', 'games') or not v:
                continue
            x = fnum(v)
            if x:
                a[k] = a.get(k, 0.0) + x * w
    for r in fetch('stats_player_reg_2025.csv', f'{REL}/stats_player/stats_player_reg_2025.csv'):
        add(r, 1.0, fnum(r['games']))
    for r in fetch('stats_player_week_%d.csv' % SEASON, f'{REL}/stats_player/stats_player_week_{SEASON}.csv'):
        if r['season_type'] == 'REG':
            add(r, 1.5, 1)
    return acc


def coverage_table(pfr_of):
    """gsis id -> pro-football-reference coverage and pass rush totals (2025, plus 2026 x1.5)."""
    gs = {v: k for k, v in pfr_of.items() if v}
    acc = {}
    for r in fetch('advstats_season_def.csv', f'{REL}/pfr_advstats/advstats_season_def.csv'):
        w = {'2025': 1.0, str(SEASON): 1.5}.get(r['season'])
        g = gs.get(r['pfr_id'])
        if not w or not g:
            continue
        a = acc.setdefault(g, {})
        tgt = fnum(r['tgt'])
        for k in ('tgt', 'cmp', 'yds', 'td', 'int', 'prss', 'sk', 'g'):
            a[k] = a.get(k, 0.0) + fnum(r[k]) * w
        a['rat_w'] = a.get('rat_w', 0.0) + fnum(r['rat']) * tgt * w
    return acc


def roster():
    rows = fetch('roster_weekly_%d.csv' % SEASON, f'{REL}/weekly_rosters/roster_weekly_{SEASON}.csv')
    out = {}
    for r in sorted(rows, key=lambda r: int(r['week'] or 0)):
        out[r['gsis_id']] = r
    return out


# ------------------------------------------------------------------ Ratings
def per(a, k, n):
    return a.get(k, 0.0) / n if n else 0.0


def shrink(val, n, prior, k):
    return (val * n + prior * k) / (n + k)


def pct_rank(xs):
    """value -> 0..1 among xs (ties share the average rank)."""
    s = sorted(xs)
    out = {}
    for x in set(xs):
        lo = sum(1 for y in s if y < x)
        eq = sum(1 for y in s if y == x)
        out[x] = (lo + (eq - 1) / 2) / max(1, len(s) - 1)
    return out


def rate(players, metric, lo=55, hi=99):
    """players: [(key, metric value)] -> key -> rating, by rank among them."""
    pr = pct_rank([v for _, v in players])
    return {k: round(lo + (hi - lo) * pr[v]) for k, v in players}


def quantile(xs, q):
    s = sorted(xs)
    return s[min(len(s) - 1, max(0, int(q * (len(s) - 1))))] if s else 0.0


def ratings(teams, st, cov, ros):
    out = {}  # (team, slot) -> rating
    by = {}   # group -> [(team, slot, value, volume)]

    def put(group, t, s, val, vol):
        by.setdefault(group, []).append((t, s, val, vol))

    for t, T in teams.items():
        for s, p in T['slots'].items():
            a = st.get(p['g'], {})
            c = cov.get(p['g'], {})
            lab = LABEL.get(s, s)
            if s == 'QB':
                plays = a.get('attempts', 0) + a.get('sacks_suffered', 0) + a.get('carries', 0)
                epa = (a.get('passing_epa', 0) + a.get('rushing_epa', 0)) / plays if plays else 0
                cpoe = a.get('passing_cpoe', 0) / max(1, a.get('games', 1))  # summed weekly cpoe -> per game
                put('QB', t, s, (epa + 0.004 * cpoe, plays), plays)
            elif s == 'RB':
                opp = a.get('carries', 0) + a.get('targets', 0)
                yds = a.get('rushing_yards', 0) + a.get('receiving_yards', 0)
                epa = a.get('rushing_epa', 0) + a.get('receiving_epa', 0)
                put('RB', t, s, ((yds / opp if opp else 0) / 10 + (epa / opp if opp else 0), opp), opp)
            elif lab in ('WR', 'TE'):
                tg = a.get('targets', 0)
                v = (a.get('receiving_epa', 0) / tg if tg else 0) + (a.get('receiving_yards', 0) / tg if tg else 0) / 20
                v += 0.6 * (a.get('target_share', 0) / max(1, a.get('games', 1)))
                put('WR' if lab == 'WR' else 'TE', t, s, (v, tg), tg)
            elif lab in ('DE', 'DT', 'NT') or (T['scheme'] == '34' and s in ('WLB', 'SLB')):
                g = max(a.get('games', 0), c.get('g', 0))
                v = (2 * a.get('def_sacks', 0) + a.get('def_qb_hits', 0) + 0.75 * a.get('def_tackles_for_loss', 0) + 0.5 * c.get('prss', 0)) / g if g else 0
                put('DL', t, s, (v, g), g)
            elif lab in ('LB',) or s in ('WLB', 'SLB'):
                g = a.get('games', 0)
                v = (a.get('def_tackles_solo', 0) + 0.5 * a.get('def_tackle_assists', 0) + 2 * a.get('def_tackles_for_loss', 0)
                     + 3 * a.get('def_pass_defended', 0) + 5 * a.get('def_interceptions', 0) + 2 * a.get('def_sacks', 0)) / g if g else 0
                tg = c.get('tgt', 0)
                rat = c['rat_w'] / tg if tg else 100.0
                put('LB', t, s, (v / 8 - (shrink(rat, tg, 105, 20) - 100) / 40, g), g)
            elif lab in ('CB', 'S', 'NB'):
                tg = c.get('tgt', 0)
                rat = c['rat_w'] / tg if tg else 100.0
                ypt = c.get('yds', 0) / tg if tg else 8.0
                g = max(a.get('games', 0), c.get('g', 0))
                plays = (a.get('def_interceptions', 0) * 2 + a.get('def_pass_defended', 0)) / g if g else 0
                v = -(shrink(rat, tg, 108, 25) - 90) / 25 - (shrink(ypt, tg, 8.5, 25) - 7) / 4 + plays
                if lab == 'S':
                    v += (a.get('def_tackles_solo', 0) / g if g else 0) / 10
                put('CB' if lab != 'S' else 'S', t, s, (v, tg + g), tg + g)
    # Shrink each group's values toward its 25th percentile by volume, then rank.
    K = {'QB': 150, 'RB': 90, 'WR': 70, 'TE': 50, 'DL': 8, 'LB': 8, 'CB': 30, 'S': 30}
    for grp, items in by.items():
        vals = [v for _, _, (v, _), vol in items if vol >= K[grp]]
        prior = quantile(vals or [v for _, _, (v, _), _ in items], 0.25)
        shr = [((t, s), shrink(v, vol, prior, K[grp])) for t, s, (v, _), vol in items]
        out.update(rate(shr, None))
    # The line: one number per team (sack rate allowed and yards per carry), then pedigree.
    team_ol = []
    tstats = {}
    for r in fetch('stats_team_reg_2025.csv', f'{REL}/stats_team/stats_team_reg_2025.csv'):
        a = tstats.setdefault(code(r['team']), {})
        for k in ('attempts', 'sacks_suffered', 'carries', 'rushing_yards'):
            a[k] = a.get(k, 0) + fnum(r[k])
    for r in fetch('stats_team_week_%d.csv' % SEASON, f'{REL}/stats_team/stats_team_week_{SEASON}.csv'):
        if r['season_type'] != 'REG':
            continue
        a = tstats.setdefault(code(r['team']), {})
        for k in ('attempts', 'sacks_suffered', 'carries', 'rushing_yards'):
            a[k] = a.get(k, 0) + 1.5 * fnum(r[k])
    for t in teams:
        a = tstats[t]
        sr = a['sacks_suffered'] / (a['attempts'] + a['sacks_suffered'])
        ypc = a['rushing_yards'] / a['carries']
        team_ol.append((t, -sr * 12 + ypc / 4))
    ol = rate(team_ol, None, 58, 94)
    for t, T in teams.items():
        for s in ('LT', 'LG', 'C', 'RG', 'RT'):
            r = ros.get(T['slots'][s]['g'], {})
            dn = int(fnum(r.get('draft_number')))
            nudge = 3 if 0 < dn <= 32 else 1 if 0 < dn <= 100 else -2 if dn == 0 else 0
            out[(t, s)] = max(55, min(99, ol[t] + nudge))
    # Kickers.
    ks = []
    for t, T in teams.items():
        a = st.get(T['k']['g'], {})
        att, made = a.get('fg_att', 0), a.get('fg_made', 0)
        long = a.get('fg_made_50_59', 0) + a.get('fg_made_60_', 0)
        ks.append(((t, 'K'), shrink(made / att if att else 0.8, att, 0.82, 10) + 0.004 * long))
    out.update(rate(ks, None, 60, 97))
    return out


# ------------------------------------------------------------------ Days
def schedule():
    rows = fetch('games.csv', f'{REL}/schedules/games.csv')
    return [r for r in rows if r['season'] == str(SEASON) and r['game_type'] == 'REG']


def days(games, team_ids):
    rnd = random.Random(20261015)
    by_week = {}
    for g in games:
        by_week.setdefault(int(g['week']), []).append(g)
    weeks = sorted(by_week)
    # A week runs Tuesday to Monday: the Monday of its last game, and the six days before.
    span = {}
    for w in weeks:
        last = max(date.fromisoformat(g['gameday']) for g in by_week[w])
        end = last + timedelta(days=(0 - last.weekday()) % 7)  # that Monday (or the day itself)
        span[w] = (end - timedelta(days=6), end)
    used = {}
    out = []
    for i in range(DAYS):
        d = START + timedelta(days=i)
        wk = next((w for w in weeks if span[w][0] <= d <= span[w][1]), None)
        seed = rnd.randrange(1, 2 ** 31)
        if wk is None:
            o, de = rnd.sample(team_ids, 2)
            out.append({'o': o, 'd': de, 's': seed})
            continue
        gs = by_week[wk]
        today = [g for g in gs if g['gameday'] == d.isoformat()]
        pool = used.setdefault(wk, set())
        g = None
        if today:
            # Thursday, Monday: their game; Sunday: the night game; Saturday (late season): its first.
            night = sorted(today, key=lambda g: g['gametime'], reverse=True)
            g = next((x for x in night if x['game_id'] not in pool), None)
        if g is None:
            left = [x for x in gs if x['game_id'] not in pool and not (x['gameday'] > d.isoformat() and x['weekday'] in ('Thursday', 'Monday'))]
            left.sort(key=lambda x: abs(fnum(x['spread_line'])))
            g = left[0] if left else rnd.choice(gs)
        pool.add(g['game_id'])
        away, home = code(g['away_team']), code(g['home_team'])
        spread = fnum(g['spread_line'])  # > 0: the home team is favoured
        dog = away if spread > 0 else home
        fav = home if dog == away else away
        o = dog if rnd.random() < 0.7 else fav
        out.append({'o': o, 'd': home if o == away else away, 's': seed, 'g': {'wk': wk, 'h': home, 'a': away, 'day': g['gameday']}})
    return out


# ------------------------------------------------------------------ Main
def main():
    teams, asof = starters()
    st = stat_table()
    ros = roster()
    pfr_of = {g: r.get('pfr_id') for g, r in ros.items()}
    cov = coverage_table(pfr_of)
    rt = ratings(teams, st, cov, ros)
    with open(os.path.join(ROOT, 'data', 'seventeen.json'), encoding='utf-8') as f:
        colors = json.load(f)['colors']
    doc_teams = {}
    for t, T in sorted(teams.items()):
        def row(s):
            p = T['slots'][s] if s != 'K' else T['k']
            r = ros.get(p['g'], {})
            j = r.get('jersey_number') or ''
            return [s, p['n'], int(j) if j.isdigit() else None, rt[(t, s)], p['e'] or None]
        doc_teams[t] = {
            'n': NAMES[t], 'city': CITY[t], 'c': list(colors[t]), 's': T['scheme'],
            'o': [row(s) for s in OFF], 'd': [row(s) for s in DEF[T['scheme']]], 'k': row('K'),
        }
    doc = {
        'about': 'Two-Minute Drill: NFL starters with ratings and one drive a day. Generated by tools/drill/build.py '
                 '(nflverse depth charts and stats) and tools/drill/tune.mjs (the situations); change the rules there, not here.',
        'asof': asof, 'start': START.isoformat(), 'teams': doc_teams, 'days': days(schedule(), sorted(doc_teams)),
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes;', len(doc['days']), 'days; depth charts as of', asof)
    if '--no-tune' not in sys.argv:
        subprocess.run(['node', os.path.join(ROOT, 'tools', 'drill', 'tune.mjs'), OUT], check=True)


if __name__ == '__main__':
    main()
