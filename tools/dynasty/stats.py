#!/usr/bin/env python3
"""Builds data/dynasty-stats-v1.json: each Gridiron Rivals player's bio and full stat tables for a card up close
(views/dynasty-stats.js), after MLB The Show's player page (the owner, Nov 2 2026: "Remove the real cards section. Expand on
the players stats. Take inspiration from the attached mlb the show stats page").

Inputs are the nflverse releases build.py reads (roster, 2025 and 2026 regular-season and weekly stats, snap counts), so the
cards' ratings (data/dynasty.json) are untouched; rebuild this alone as the weeks go by:
  python3 tools/dynasty/stats.py [--cache DIR]      (then bump CACHE in sw.js; a changed format gets a new -vN name)

Out: {season, asof, cols: {group: [label, ...]}, p: {player key: [bio, now, prev, log, ranks]}}
  bio   [height in inches, weight, birth date YYYY-MM-DD, draft club, draft pick, entry year]
  now   this season's row (strings, cols[group] order; the first is games), or 0
  prev  last season's, or 0
  log   his last five games this season: [week, opponent, home(1)/away(0), ...cols without G]
  ranks his place at his position this season in the group's headline stats: [[label, rank, of], ...]
"""
import csv, datetime, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'data', 'dynasty-stats-v1.json')
CARDS = os.path.join(ROOT, 'data', 'dynasty.json')
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
GROUP = {'QB': 'QB', 'RB': 'RB', 'WR': 'REC', 'TE': 'REC', 'K': 'K', 'OL': 'OL', 'DL': 'DEF', 'LB': 'DEF', 'CB': 'DEF', 'S': 'DEF'}


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


def i(x):
    return f'{int(round(x)):,}'


def d1(a, b):
    return f'{a / b:.1f}' if b else '–'


def pct(a, b):
    return f'{100 * a / b:.1f}' if b else '–'


# Each group's columns: (label, from a stat row s (and his snaps sn: [games, snaps, share sum])), and the headline stats
# ranked at his position: (label, value, higher is better)
COLS = {
    'QB': [('G', lambda s, sn: i(num(s['games']))), ('CMP', lambda s, sn: i(num(s['completions']))), ('ATT', lambda s, sn: i(num(s['attempts']))),
           ('CMP%', lambda s, sn: pct(num(s['completions']), num(s['attempts']))), ('YDS', lambda s, sn: i(num(s['passing_yards']))),
           ('TD', lambda s, sn: i(num(s['passing_tds']))), ('INT', lambda s, sn: i(num(s['passing_interceptions']))),
           ('Y/A', lambda s, sn: d1(num(s['passing_yards']), num(s['attempts']))), ('SCK', lambda s, sn: i(num(s['sacks_suffered']))),
           ('RUSH', lambda s, sn: i(num(s['rushing_yards']))), ('RTD', lambda s, sn: i(num(s['rushing_tds'])))],
    'RB': [('G', lambda s, sn: i(num(s['games']))), ('CAR', lambda s, sn: i(num(s['carries']))), ('YDS', lambda s, sn: i(num(s['rushing_yards']))),
           ('Y/C', lambda s, sn: d1(num(s['rushing_yards']), num(s['carries']))), ('TD', lambda s, sn: i(num(s['rushing_tds']))),
           ('20+', lambda s, sn: i(num(s['rushing_20']))), ('TGT', lambda s, sn: i(num(s['targets']))), ('REC', lambda s, sn: i(num(s['receptions']))),
           ('RYDS', lambda s, sn: i(num(s['receiving_yards']))), ('RTD', lambda s, sn: i(num(s['receiving_tds']))),
           ('FUM', lambda s, sn: i(num(s['rushing_fumbles_lost']) + num(s['receiving_fumbles_lost'])))],
    'REC': [('G', lambda s, sn: i(num(s['games']))), ('TGT', lambda s, sn: i(num(s['targets']))), ('REC', lambda s, sn: i(num(s['receptions']))),
            ('YDS', lambda s, sn: i(num(s['receiving_yards']))), ('Y/R', lambda s, sn: d1(num(s['receiving_yards']), num(s['receptions']))),
            ('TD', lambda s, sn: i(num(s['receiving_tds']))), ('YAC', lambda s, sn: i(num(s['receiving_yards_after_catch']))),
            ('1ST', lambda s, sn: i(num(s['receiving_first_downs']))), ('20+', lambda s, sn: i(num(s['receiving_20']))),
            ('CTH%', lambda s, sn: pct(num(s['receptions']), num(s['targets'])))],
    'K': [('G', lambda s, sn: i(num(s['games']))), ('FGM', lambda s, sn: i(num(s['fg_made']))), ('FGA', lambda s, sn: i(num(s['fg_att']))),
          ('FG%', lambda s, sn: pct(num(s['fg_made']), num(s['fg_att']))), ('LONG', lambda s, sn: i(num(s['fg_long']))),
          ('40-49', lambda s, sn: i(num(s['fg_made_40_49']))), ('50+', lambda s, sn: i(num(s['fg_made_50_59']) + num(s['fg_made_60_']))),
          ('XPM', lambda s, sn: i(num(s['pat_made']))), ('XPA', lambda s, sn: i(num(s['pat_att'])))],
    'DEF': [('G', lambda s, sn: i(num(s['games']))), ('TKL', lambda s, sn: i(num(s['def_tackles_solo']) + num(s['def_tackle_assists']))),
            ('SOLO', lambda s, sn: i(num(s['def_tackles_solo']))), ('TFL', lambda s, sn: i(num(s['def_tackles_for_loss']))),
            ('SCK', lambda s, sn: f"{num(s['def_sacks']):g}"), ('QBH', lambda s, sn: i(num(s['def_qb_hits']))),
            ('INT', lambda s, sn: i(num(s['def_interceptions']))), ('PD', lambda s, sn: i(num(s['def_pass_defended']))),
            ('FF', lambda s, sn: i(num(s['def_fumbles_forced']))), ('TD', lambda s, sn: i(num(s['def_tds'])))],
    'OL': [('G', lambda s, sn: i(sn[0])), ('SNAPS', lambda s, sn: i(sn[1])), ('SNAP%', lambda s, sn: f'{100 * sn[2] / sn[0]:.0f}' if sn[0] else '–'),
           ('ST', lambda s, sn: i(sn[3]))],
}
RANKS = {
    'QB': [('Passing yards', lambda s: num(s['passing_yards'])), ('Passing TDs', lambda s: num(s['passing_tds'])),
           ('Completion %', lambda s: num(s['completions']) / num(s['attempts']) if num(s['attempts']) >= 100 else -1),
           ('Rushing yards', lambda s: num(s['rushing_yards']))],
    'RB': [('Rushing yards', lambda s: num(s['rushing_yards'])), ('Total TDs', lambda s: num(s['rushing_tds']) + num(s['receiving_tds'])),
           ('Yards per carry', lambda s: num(s['rushing_yards']) / num(s['carries']) if num(s['carries']) >= 50 else -1),
           ('Receiving yards', lambda s: num(s['receiving_yards']))],
    'REC': [('Receiving yards', lambda s: num(s['receiving_yards'])), ('Receptions', lambda s: num(s['receptions'])),
            ('Receiving TDs', lambda s: num(s['receiving_tds'])), ('Yards after catch', lambda s: num(s['receiving_yards_after_catch']))],
    'K': [('Field goals', lambda s: num(s['fg_made'])), ('FG %', lambda s: num(s['fg_made']) / num(s['fg_att']) if num(s['fg_att']) >= 8 else -1),
          ('Long', lambda s: num(s['fg_long']))],
    'DEF': [('Tackles', lambda s: num(s['def_tackles_solo']) + num(s['def_tackle_assists'])), ('Sacks', lambda s: num(s['def_sacks'])),
            ('Interceptions', lambda s: num(s['def_interceptions'])), ('Passes defended', lambda s: num(s['def_pass_defended']))],
    'OL': [],
}


def snaps(rows):
    """pfr id -> [games, snaps, share sum, special-teams snaps] (offense for an offensive player, else defense)."""
    out = {}
    for r in rows:
        if r.get('game_type', 'REG') != 'REG':
            continue
        off = num(r['offense_snaps']) >= num(r['defense_snaps'])
        sn, sh = (num(r['offense_snaps']), num(r['offense_pct'])) if off else (num(r['defense_snaps']), num(r['defense_pct']))
        o = out.setdefault(r['pfr_player_id'], [0, 0, 0.0, 0])
        if sn > 0:
            o[0] += 1
            o[1] += sn
            o[2] += sh
        o[3] += num(r['st_snaps'])
    return out


def main():
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache')
    d = fetch(cache)
    with open(CARDS, encoding='utf-8') as f:
        cards = json.load(f)
    players = cards['players']   # key -> [name, team, pos, ...]
    roster = {r['gsis_id']: r for r in d['roster'] if r.get('gsis_id')}
    now = {r['player_id']: r for r in d['reg_now'] if r.get('season_type', 'REG') == 'REG'}
    prev = {r['player_id']: r for r in d['reg_prev'] if r.get('season_type', 'REG') == 'REG'}
    sn_now, sn_prev = snaps(d['snaps_now']), snaps(d['snaps_prev'])
    # (a roster row without a pfr id: his snap rows by his name, when only one player has it)
    by_name = {}
    for r in d['snaps_prev'] + d['snaps_now']:
        by_name.setdefault(r['player'].lower(), set()).add(r['pfr_player_id'])
    def pfr_of(r):
        if r.get('pfr_id'):
            return r['pfr_id']
        ids = by_name.get(r['full_name'].lower(), set())
        return next(iter(ids)) if len(ids) == 1 else ''
    weeks = {}
    for r in d['week_now']:
        if r.get('season_type', 'REG') == 'REG':
            weeks.setdefault(r['player_id'], []).append(r)
    last_week = max((int(r['week']) for r in d['week_now'] if r.get('season_type', 'REG') == 'REG'), default=0)
    # (home or away: a game id is season_week_away_home)
    home = lambda r: 1 if r.get('game_id', '').rsplit('_', 1)[-1] == r['team'] else 0

    # rankings at each card position this season
    pos_of = {'00-' + k: v[2] for k, v in players.items() if not k.startswith('x')}
    ranks = {}
    for g, defs in RANKS.items():
        for pos in [p for p, gg in GROUP.items() if gg == g]:
            ids = [gs for gs, p in pos_of.items() if p == pos and gs in now]
            for label, f in defs:
                vals = sorted(((f(now[gs]), gs) for gs in ids), reverse=True)
                vals = [v for v in vals if v[0] > 0]
                for n, (v, gs) in enumerate(vals):
                    ranks.setdefault(gs, []).append([label, n + 1, len(vals)])

    out = {}
    for key, pl in players.items():
        if key.startswith('x'):
            continue
        gs = '00-' + key
        r = roster.get(gs)
        g = GROUP[pl[2]]
        pfr = pfr_of(r) if r else ''
        row = lambda s, sn: [f(s, sn) for _, f in COLS[g]] if (sn and sn[0] if g == 'OL' else s) else 0
        bio = [int(num(r['height'])), int(num(r['weight'])), r['birth_date'] or '', r['draft_club'] or '', int(num(r['draft_number'])),
               int(num(r['entry_year']))] if r else [0, 0, '', '', 0, 0]
        log = []
        if g != 'OL':
            for w in sorted(weeks.get(gs, []), key=lambda w: -int(w['week']))[:5]:
                log.append([int(w['week']), w['opponent_team'], home(w)] + [f(w, None) for _, f in COLS[g][1:]])
        out[key] = [bio, row(now.get(gs), sn_now.get(pfr)), row(prev.get(gs), sn_prev.get(pfr)), log, ranks.get(gs, [])]
    res = {'about': 'Gridiron Rivals player pages: bio and stats from nflverse. Built by tools/dynasty/stats.py.', 'v': 1,
           'season': SEASON, 'asof': f'{SEASON} week {last_week}', 'built': datetime.date.today().isoformat(),
           'cols': {g: [c[0] for c in cs] for g, cs in COLS.items()}, 'group': GROUP, 'p': out}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, separators=(',', ':'))
    print('players', len(out), 'bytes', os.path.getsize(OUT), 'asof', res['asof'], file=sys.stderr)


if __name__ == '__main__':
    main()
