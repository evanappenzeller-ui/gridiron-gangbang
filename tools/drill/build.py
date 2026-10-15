#!/usr/bin/env python3
"""Two-Minute Drill data: every NFL team's starters with a rating, and one drive a day.

Run: python3 tools/drill/build.py  (standard library only; then bump CACHE in sw.js). It downloads nflverse's data
into CACHE (env DRILL_CACHE, default ~/.cache/gridiron-drill; delete it to pull fresh depth charts), writes
data/drill.json, then runs tools/drill/tune.mjs (node), which sets each day's situation with the game's own engine
(js/core/drill-sim.js).

THE STARTERS. ESPN's depth charts as nflverse saved them last (depth_charts/depth_charts_2026.csv, the newest
snapshot per team): on offense the 3WR 1TE set (QB, RB, the top three WRs, TE and the five linemen), on defense the
base front plus the nickel back, and the kicker. Jersey numbers come from the weekly rosters. A depth chart's id can be
another man's of the same name (a retired Blake Miller for the rookie): one with no roster row on his team is found on
its roster by name. A depth chart can still list a man who won't play this week (Who: the weekly rosters, the injury
reports, and the snap counts matched by pro-football-reference id from nflverse's players file):
  - his latest weekly roster has him on injured reserve, released, suspended or the like, or on another team;
  - this week's injury report has him out or doubtful;
  - he missed his team's last game or left it early (under 40% of its snaps) and is sitting out this week's practice
    hurt (not a veteran's rest day; unless he's listed questionable), or he missed it (under 5%) and, with no report
    from his team yet this week, was ruled out last week;
  - or it hasn't caught up with a benching: it already listed him as the starter before the last game, and he sat out
    that one and the one before (under 5% of the snaps in each, wherever he played them: a man traded since counts
    his old team's games) without being on an injury report this week or last. (A man it has moved up since the last
    game is its own news, an injury ahead of him, so he starts.)
The man who starts instead: the next at the spot who played in the last game (30% of its snaps or more), else whoever
played the spot's positions most in it (and isn't starting elsewhere), else the next at the spot, else a backup at the
spots beside it (FALLBACK), else their starter. The build prints who was passed over and why.

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
needs the drive: the underdog most days. After week 18, random pairs. Every game starts with your ball and 2:00
left; the rest of the situation (score, ball, timeouts) is tune.mjs's.
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


# ------------------------------------------------------------------ Who can play
OUT_STATUS = {'RES': 'on injured reserve', 'CUT': 'released', 'RET': 'retired', 'DEV': 'on the practice squad',
              'EXE': 'exempt', 'SUS': 'suspended', 'PUP': 'on the PUP list', 'NFI': 'on the NFI list', 'NON': 'on the non-football list'}


def norm(n):
    n = n.lower()
    for sfx in (' jr.', ' sr.', ' iii', ' ii', ' iv'):
        n = n.replace(sfx, '')
    return ''.join(ch for ch in n if ch.isalpha())


class Who:
    """Who can play this week, from the weekly rosters, the injury reports and the snap counts (pro-football-
    reference's, matched by its id from nflverse's players file, else by name: a lineman's "DJ" is its "Delmar").
      out[g]          why gsis id g won't play this week (absent: nothing says so; see THE STARTERS)
      played(g, w)    his share of his team's snaps in week w (a man traded since: his old team's that week)
      last[t], prev[t]  team t's last game week and the one before
      reported        the ids on an injury report this week or last
      snaps[t]        [(gsis id, share)] in team t's last game
      ros[g], info[g] his latest weekly roster row; his players-file row"""

    def __init__(self):
        self.ros = roster()
        self.info = {r['gsis_id']: r for r in fetch('players.csv', f'{REL}/players/players.csv')}
        g_of = {r['pfr_id']: g for g, r in self.info.items() if r['pfr_id']}
        inj = {}
        rows = [r for r in fetch('injuries_%d.csv' % SEASON, f'{REL}/injuries/injuries_{SEASON}.csv') if r['season_type'] == 'REG']
        for r in rows:
            inj.setdefault(r['gsis_id'], {})[int(r['week'])] = r
        week = max(int(r['week']) for r in rows)
        self.reported = {g for g, rep in inj.items() if week in rep or week - 1 in rep}
        self.share, weeks, self.snaps = {}, {}, {}
        snap_rows = [r for r in fetch('snap_counts_%d.csv' % SEASON, f'{REL}/snap_counts/snap_counts_{SEASON}.csv') if r['game_type'] == 'REG']
        for r in snap_rows:
            t, w = code(r['team']), int(r['week'])
            weeks.setdefault(t, set()).add(w)
            pct = max(fnum(r['offense_pct']), fnum(r['defense_pct']), fnum(r['st_pct']) if r['position'] in ('K', 'P') else 0)
            self.share[(t, w, 'id', r['pfr_player_id'])] = pct
            self.share[(t, w, 'n', norm(r['player']))] = pct
            self.share[(w, 'id', r['pfr_player_id'])] = max(pct, self.share.get((w, 'id', r['pfr_player_id']), 0))
        self.last = {t: max(ws) for t, ws in weeks.items()}
        self.prev = {t: max([w for w in ws if w < self.last[t]], default=None) for t, ws in weeks.items()}
        for r in snap_rows:
            t = code(r['team'])
            if int(r['week']) == self.last[t] and g_of.get(r['pfr_player_id']):
                self.snaps.setdefault(t, []).append((g_of[r['pfr_player_id']], self.share[(t, self.last[t], 'id', r['pfr_player_id'])]))
        self.out = {}
        for g, r in self.ros.items():
            t, lw = code(r['team']), self.last.get(code(r['team']))
            if r['status'] in OUT_STATUS:
                self.out[g] = f"{OUT_STATUS[r['status']]} (week {r['week']})"
                continue
            rep = inj.get(g, {})
            now, before = rep.get(week), rep.get(week - 1)
            if now and now['report_status'] in ('Out', 'Doubtful'):
                self.out[g] = f"{now['report_status'].lower()} this week ({now['report_primary_injury'] or 'injury'})"
                continue
            got = self.played(g, lw)
            if not lw or got >= 0.4:
                continue
            hurt = 'Not injury related' not in (now['practice_primary_injury'] or '') + (now['report_primary_injury'] or '') if now else False
            early = f"missed week {lw}" if got < 0.05 else f"left week {lw} early"
            if hurt and 'Did Not' in (now['practice_status'] or '') and now['report_status'] != 'Questionable':
                self.out[g] = f"{early}, not practising ({now['practice_primary_injury'] or now['report_primary_injury'] or 'injury'})"
            elif not now and got < 0.05 and before and before['report_status'] in ('Out', 'Doubtful'):
                self.out[g] = f"{early}, ruled out then ({before['report_primary_injury'] or 'injury'})"

    def played(self, g, w):
        r, i = self.ros.get(g), self.info.get(g, {})
        if not r or not w:
            return 0.0
        t, pid = code(r['team']), r['pfr_id'] or i.get('pfr_id')
        names = {norm(r['full_name'])} | {norm(f"{x} {i.get('last_name', '')}") for x in (i.get('first_name'), i.get('football_name')) if x}
        by_id = [self.share.get((t, w, 'id', pid), 0), self.share.get((w, 'id', pid), 0)] if pid else []
        return max(by_id + [self.share.get((t, w, 'n', n), 0) for n in names] + [0])


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
    'QB': [], 'RB': [], 'TE': [], 'PK': [],
}
# The roster positions (depth_chart_position; ngs_position EDGE: a pass rusher) that can fill a spot: a man who played
# there last game, when the depth chart's next man didn't play at all. Inside linebackers aren't edge rushers; a 3-4's
# outside linebackers are, and a 4-3's aren't.
OT, IOL, ILB = {'T', 'OT', 'LT', 'RT'}, {'G', 'OG', 'LG', 'RG', 'C'}, {'ILB', 'MLB', 'LB'}
GROUP = {
    'QB': {'QB'}, 'RB': {'RB', 'HB', 'FB'}, 'WR': {'WR'}, 'TE': {'TE'},
    'LT': OT, 'RT': OT, 'LG': IOL, 'RG': IOL, 'C': IOL,
    'LDE': {'DE', 'EDGE'}, 'RDE': {'DE', 'EDGE'}, 'LDT': {'DT', 'NT', 'DL'}, 'RDT': {'DT', 'NT', 'DL'}, 'NT': {'NT', 'DT'},
    'MLB': ILB, 'LILB': ILB, 'RILB': ILB, ('34', 'WLB'): {'OLB', 'DE', 'EDGE'}, ('34', 'SLB'): {'OLB', 'DE', 'EDGE'},
    ('43', 'WLB'): ILB | {'OLB', 'WLB', 'SLB'}, ('43', 'SLB'): ILB | {'OLB', 'WLB', 'SLB'},
    'LCB': {'CB', 'DB'}, 'RCB': {'CB', 'DB'}, 'NB': {'CB', 'DB'}, 'SS': {'SS', 'FS', 'S', 'DB'}, 'FS': {'SS', 'FS', 'S', 'DB'}, 'PK': {'K'},
}


def starters():
    W = Who()
    ros, last = W.ros, W.last
    skipped, fixed = [], []
    # The depth charts' ids can be another man's of the same name (a retired Blake Miller for the rookie): a man with no
    # roster row on his team is found on its roster by name.
    on_team = {}
    for g, r in ros.items():
        for n in (r['full_name'], f"{r['football_name']} {r['last_name']}", f"{r['first_name']} {r['last_name']}"):
            on_team.setdefault((code(r['team']), norm(n)), g)
    rows = fetch('depth_charts_%d.csv' % SEASON, f'{REL}/depth_charts/depth_charts_{SEASON}.csv')
    latest = {}
    for r in rows:
        latest[r['team']] = max(latest.get(r['team'], ''), r['dt'])
    asof = max(latest.values())[:10]
    # Each team's depth chart as it stood before its last game: a starter it already listed then who didn't play is a
    # benching it hasn't caught up with; one it has moved up since is its own news (an injury ahead of him).
    day = {}
    for gm in schedule():
        for side in ('home_team', 'away_team'):
            day[(code(gm[side]), int(gm['week']))] = gm['gameday']
    then = {}
    for r in rows:
        t = code(r['team'])
        d = day.get((t, last.get(t)))
        if d and r['dt'][:10] < d and r['dt'] > then.get(t, ''):
            then[t] = r['dt']
    was = {(code(r['team']), r['pos_abb'], norm(r['player_name'])): int(r['pos_rank'] or 99)
           for r in rows if r['dt'] == then.get(code(r['team'])) and r['player_name'].strip()}
    depth = {}  # team -> {'off': {pos: [(rank, p)]}, 'def': {...}, 'wr': [...], 'k': [...], 'scheme'}
    for r in rows:
        if r['dt'] != latest[r['team']] or (r['pos_grp'] == 'Special Teams' and r['pos_abb'] != 'PK'):
            continue
        if not r['player_name'].strip() or not r['gsis_id']:
            continue
        t = depth.setdefault(code(r['team']), {'off': {}, 'def': {}, 'wr': [], 'k': [], 'scheme': None})
        rank = int(r['pos_rank'] or 99)
        p = {'n': r['player_name'].strip(), 'g': r['gsis_id'], 'e': r['espn_id'], 'pos': r['pos_abb']}
        mine = ros.get(p['g'])
        if not mine or code(mine['team']) != code(r['team']):
            g = on_team.get((code(r['team']), norm(p['n'])))
            if g and g != p['g']:
                fixed.append(f"{code(r['team'])} {p['n']}")
                p['g'], p['e'] = g, W.info.get(g, {}).get('espn_id') or ros[g]['espn_id'] or None
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
        # Every man the depth chart starts somewhere (the top three receivers): a spot's stand-in isn't taken from them.
        listed = {p['g'] for side in ('off', 'def') for ps in t[side].values() for r, p in ps if r == 1}
        listed |= {p['g'] for r, p in t['wr'] if r <= 3} | {p['g'] for r, p in t['k'] if r == 1}
        played = lambda g: W.played(g, last.get(k))

        def out(p, pos, note=True):
            """Why p won't play (noted the first time, if note), or None."""
            r = ros.get(p['g'])
            why = W.out.get(p['g']) or (f"now with {code(r['team'])}" if r and code(r['team']) != k else None)
            if why and note and p['g'] not in used:
                used.add(p['g'])
                skipped.append(f'{k} {pos}: {p["n"]}, {why}')
            return why

        def free(p, pos, note=True):
            return p['g'] not in used and not out(p, pos, note)

        def benched(p, pos):
            """A starter the depth chart already listed before the last game who sat out that one and the one before,
            not coming back from an injury: noted, and True."""
            g, top = p['g'], 3 if pos == 'WR' else 1
            if g in used or g in W.reported or g not in ros or not last.get(k) or was.get((k, p['pos'], norm(p['n'])), 99) > top:
                return False
            if played(g) >= 0.05 or (W.prev.get(k) and W.played(g, W.prev[k]) >= 0.05):
                return False
            used.add(g)
            skipped.append(f'{k} {pos}: {p["n"]}, sat out the last two games, not hurt (the job went to someone else)')
            return True

        def stand_in(pos):
            """The man who played the spot last game: the most snaps among those at its positions who aren't hurt,
            aren't starting elsewhere and aren't in yet."""
            fits = GROUP.get((t['scheme'], pos)) or GROUP[pos]
            edge_ok = 'EDGE' in fits
            best = None
            for g, pct in W.snaps.get(k, []):
                r = ros.get(g)
                if not r or code(r['team']) != k or pct < 0.3 or g in used or g in listed or g in W.out:
                    continue
                at, rush = r['depth_chart_position'], r['ngs_position'] == 'EDGE'
                if (at in fits or (rush and edge_ok)) and not (rush and not edge_ok and at not in ('DT', 'NT')):
                    if not best or pct > best[1]:
                        best = (g, pct)
            if not best:
                return None
            g = best[0]
            i, r = W.info.get(g, {}), ros[g]
            return {'n': i.get('display_name') or r['full_name'], 'g': g, 'e': i.get('espn_id') or r['espn_id'] or None, 'pos': pos}

        def take(side, pos):
            own = [p for _, p in sorted(t[side].get(pos, []), key=lambda x: x[0])]
            if own and free(own[0], pos) and not benched(own[0], pos):
                pick = own[0]
            else:
                subs = [p for p in own[1:] if free(p, pos)]
                pick = next((p for p in subs if played(p['g']) >= 0.3), None)
                pick = pick or stand_in(pos) or (subs[0] if subs else None)
                if not pick:
                    near = [(r, p) for cand in FALLBACK.get(pos, []) for r, p in sorted(t[side].get(cand, []), key=lambda x: x[0])]
                    pick = next((p for r, p in near if r > 1 and free(p, pos)), None) or next((p for r, p in near if free(p, pos)), None)
            if pick:
                used.add(pick['g'])
            return pick
        # Receivers: the depth chart's top three who'll play, any gap filled the same way as a spot's.
        ranked = [p for _, p in sorted(t['wr'], key=lambda x: x[0])]
        wrs = [p for p in ranked[:3] if free(p, 'WR') and not benched(p, 'WR')]
        used.update(p['g'] for p in wrs)
        rest = [p for p in ranked[3:] if free(p, 'WR', note=False)]
        while len(wrs) < 3:
            pick = next((p for p in rest if p['g'] not in used and played(p['g']) >= 0.3), None) or stand_in('WR') \
                or next((p for p in rest if p['g'] not in used), None)
            if not pick:
                break
            wrs.append(pick)
            used.add(pick['g'])
        wrs.sort(key=lambda p: ranked.index(p) if p in ranked else len(ranked))
        for i, p in enumerate(wrs):
            slots['WR%d' % (i + 1)] = p
        for pos in OFF:
            if pos not in slots:
                slots[pos] = take('off', pos)
        for pos in DEF[t['scheme']]:
            slots[pos] = take('def', pos)
        # The kicker: the depth chart's, or whoever kicked last game when he's out or didn't kick it.
        ks = [p for _, p in sorted(t['k'], key=lambda x: x[0])]
        if ks and free(ks[0], 'K') and not benched(ks[0], 'K'):
            kick = ks[0]
        else:
            kick = next((p for p in ks[1:] if free(p, 'K') and played(p['g']) >= 0.3), None) or stand_in('PK') \
                or next((p for p in ks[1:] if free(p, 'K')), None)
        miss = [s for s in OFF + DEF[t['scheme']] if not slots.get(s)]
        if miss or not kick:
            sys.exit(f'{k}: no starter at {miss or "PK"}')
        teams[k] = {'slots': slots, 'scheme': t['scheme'], 'k': kick}
    if len(teams) != 32:
        sys.exit(f'{len(teams)} teams in the depth charts')
    print(f'{len(set(fixed))} depth chart ids fixed by name: ' + ', '.join(sorted(set(fixed))), file=sys.stderr)
    print(f"{len(skipped)} on the depth charts won't play this week; the next man starts:", file=sys.stderr)
    for line in sorted(skipped):
        print('  ' + line, file=sys.stderr)
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
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'drill', 'coaches.py'), OUT], check=True)


if __name__ == '__main__':
    main()
