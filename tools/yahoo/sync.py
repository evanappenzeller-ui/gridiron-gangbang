#!/usr/bin/env python3
"""Pulls the league's scores and projections from Yahoo Fantasy into data/league.json.

Run by .github/workflows/yahoo-sync.yml. Standard library only.

  python3 tools/yahoo/sync.py link            print the Yahoo sign-in link (needs YAHOO_CLIENT_ID)
  python3 tools/yahoo/sync.py connect CODE    trade the sign-in code for a saved login
  python3 tools/yahoo/sync.py sync            update data/league.json

Environment: YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET (repo secrets), optional YAHOO_LEAGUE_ID (the
number in the league's URL; otherwise the signed-in user's NFL league named like league.json's) and
YAHOO_REDIRECT_URI (default: the app's yahoo.html page, which shows the code; it must match the Yahoo app's
redirect URI exactly). YAHOO_ROOT, YAHOO_AUTH_BASE and YAHOO_API_BASE point it elsewhere for check-sync.py.

The login is a Yahoo refresh token, kept in TOKEN_FILE encrypted with the client secret (AES-256 via
openssl), so the workflow can save it, and save a rotated one, without write access to repo secrets.

What a sync writes, for the season Yahoo is on:
  matchups   every finished week (status postevent), with playoff rounds named as in past seasons;
             finished weeks are rewritten each run, so stat corrections come through
  schedule   regular-season weeks not finished yet; the current week also gets Yahoo's projected
             points (pa, pb) and win chance for a in percent (wa)
  teams      this season's team names, and each manager's current team name
  inProgress false once Yahoo says the season is finished
  rosters    every manager's players now, [name, position, NFL team, lineup slot], with `at`, when they last changed,
             and `week`, the week those lineups are for (the app scores them live: js/core/fantasy-live.js)
  pickups, drops, trades   the season's moves from Yahoo's League Transactions (same shape as the ones entered by
             hand). Yahoo's replace the ones on file from the same span; older ones on file Yahoo didn't return stay.
The rosters and moves are extras: if either fails, the run warns and still syncs the scores.
Yahoo team ids are matched to managers once per season (by team name, then manager nickname) and
kept in TEAMS_FILE; fix that file by hand if a match is ever wrong.
"""
import base64
import datetime
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.environ.get('YAHOO_ROOT') or os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LEAGUE_FILE = os.path.join(ROOT, 'data', 'league.json')
TEAMS_FILE = os.path.join(ROOT, 'tools', 'yahoo', 'teams.json')
TOKEN_FILE = os.path.join(ROOT, 'tools', 'yahoo', 'token.enc')
AUTH = os.environ.get('YAHOO_AUTH_BASE', 'https://api.login.yahoo.com/oauth2')
API = os.environ.get('YAHOO_API_BASE', 'https://fantasysports.yahooapis.com/fantasy/v2')
REDIRECT = os.environ.get('YAHOO_REDIRECT_URI') or 'https://evanappenzeller-ui.github.io/gridiron-gangbang/yahoo.html'


class Stop(Exception):
    """A problem the person running the sync has to fix; printed without a traceback."""


class Waiting(Exception):
    """Nothing to fix here yet (Yahoo approval pending): reported as a warning, and the run still passes."""


def env(name):
    v = (os.environ.get(name) or '').strip()
    if not v:
        raise Stop(f'{name} is not set. Add it under Settings > Secrets and variables > Actions.')
    return v


# --- the saved login -------------------------------------------------------------------------------

def openssl(args, data):
    p = subprocess.run(['openssl', 'enc', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-a', '-A', *args,
                        '-pass', 'env:YAHOO_CLIENT_SECRET'], input=data, capture_output=True)
    if p.returncode:
        raise Stop('Could not read the saved Yahoo login (was YAHOO_CLIENT_SECRET changed?). '
                   'Connect Yahoo again: run the workflow with a new code.')
    return p.stdout


def save_refresh(tok):
    env('YAHOO_CLIENT_SECRET')
    with open(TOKEN_FILE, 'wb') as f:
        f.write(openssl(['-salt'], tok.encode()) + b'\n')


def load_refresh():
    env('YAHOO_CLIENT_SECRET')
    if not os.path.exists(TOKEN_FILE):
        raise Stop('Yahoo is not connected yet. Run the workflow once with no code to get the sign-in link.')
    with open(TOKEN_FILE, 'rb') as f:
        return openssl(['-d'], f.read().strip()).decode().strip()


def token_call(form):
    basic = base64.b64encode(f"{env('YAHOO_CLIENT_ID')}:{env('YAHOO_CLIENT_SECRET')}".encode()).decode()
    req = urllib.request.Request(AUTH + '/get_token', data=urllib.parse.urlencode(form).encode(), method='POST',
                                 headers={'Authorization': 'Basic ' + basic,
                                          'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')[:300]
        raise Stop(f'Yahoo refused the login ({e.code}): {body}')


def access_token():
    old = load_refresh()
    j = token_call({'grant_type': 'refresh_token', 'refresh_token': old, 'redirect_uri': REDIRECT})
    if j.get('refresh_token') and j['refresh_token'] != old:
        save_refresh(j['refresh_token'])
    return j['access_token']


# --- Yahoo's API -----------------------------------------------------------------------------------

def strip_ns(el):
    for x in el.iter():
        if isinstance(x.tag, str) and '}' in x.tag:
            x.tag = x.tag.split('}', 1)[1]
    return el


def get(tok, path):
    req = urllib.request.Request(API + '/' + path, headers={'Authorization': 'Bearer ' + tok})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return strip_ns(ET.fromstring(r.read()))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        why = re.search(r'<description>(.*?)</description>', body, re.S)
        why = why.group(1).strip().rstrip('.') if why else body[:300]
        if e.code in (401, 403) and 'not authorized' in why.lower():
            # Since mid-2026 Yahoo only serves the Fantasy API to apps it has approved. Until then every call
            # is refused; that's a wait, not a failure, so scheduled runs stay green instead of emailing twice a day.
            raise Waiting('Yahoo has not approved this app for the Fantasy Sports API yet. Apply (or confirm the '
                          'Client ID) at https://sports.yahoo.com/developer/access/ ; syncing starts once it is approved.')
        raise Stop(f'Yahoo API {path} answered {e.code}: {why}.')


def txt(el, path, default=None):
    x = el.find(path)
    return x.text.strip() if x is not None and x.text else default


def num(el, path):
    v = txt(el, path)
    try:
        return round(float(v), 2) if v is not None else None
    except ValueError:
        return None


def squash(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


def find_league(tok, name):
    lid = (os.environ.get('YAHOO_LEAGUE_ID') or '').strip()
    if lid:
        if '.l.' in lid:
            return lid
        game = txt(get(tok, 'game/nfl'), 'game/game_key')
        return f'{game}.l.{lid}'
    root = get(tok, 'users;use_login=1/games;game_keys=nfl/leagues')
    leagues = [(txt(l, 'league_key'), txt(l, 'name', '')) for l in root.iter('league')]
    if not leagues:
        raise Stop('The signed-in Yahoo account has no NFL league this season.')
    if len(leagues) == 1:
        return leagues[0][0]
    hit = [k for k, n in leagues if squash(n) == squash(name)]
    if len(hit) == 1:
        return hit[0]
    raise Stop('More than one Yahoo NFL league; set the YAHOO_LEAGUE_ID variable to one of: '
               + ', '.join(f'{n} ({k.split(".l.")[-1]})' for k, n in leagues))


def read_week(tok, key, week):
    root = get(tok, f'league/{key}/scoreboard;week={week}')
    out = []
    for m in root.iter('matchup'):
        teams = []
        for t in m.iter('team'):
            wp = num(t, 'win_probability')
            teams.append({'id': txt(t, 'team_id'), 'pts': num(t, 'team_points/total'),
                          'proj': num(t, 'team_projected_points/total'), 'win': wp})
        if len(teams) != 2:
            continue
        out.append({'week': int(txt(m, 'week', week)), 'status': txt(m, 'status', ''),
                    'playoffs': txt(m, 'is_playoffs') == '1', 'consol': txt(m, 'is_consolation') == '1',
                    'teams': teams})
    return out


# --- matching Yahoo teams to managers --------------------------------------------------------------

def match_teams(data, season, yteams, year):
    """{yahoo team_id: manager id} for this season: saved, else matched by team name then nickname."""
    saved = {}
    if os.path.exists(TEAMS_FILE):
        with open(TEAMS_FILE, encoding='utf-8') as f:
            saved = json.load(f)
    got = dict(saved.get(str(year), {}).get('teams', {}))
    if all(t['id'] in got for t in yteams):
        return got, saved, False
    managers = data['managers']
    names = dict((season or {}).get('teams') or {})
    for m in managers:
        names.setdefault(m['id'], m.get('team', ''))
    taken = set(got.values())
    for t in yteams:
        if t['id'] in got:
            continue
        by_team = [mid for mid, n in names.items() if mid not in taken and squash(n) and squash(n) == squash(t['name'])]
        by_nick = [m['id'] for m in managers if m['id'] not in taken and any(
            squash(n) and (squash(n) == squash(m['name']) or squash(n) == squash(m['id'])
                           or squash(n.split(' ')[0]) == squash(m['name'])) for n in t['nicks'])]
        pick = by_team if len(by_team) == 1 else by_nick if len(by_nick) == 1 else []
        if pick:
            got[t['id']] = pick[0]
            taken.add(pick[0])
    missing = [t for t in yteams if t['id'] not in got]
    if missing:
        rows = '\n'.join(f"  team {t['id']}: {t['name']} (manager {', '.join(t['nicks']) or '?'})" for t in missing)
        raise Stop(f'Could not tell which manager owns these Yahoo teams. Add them to tools/yahoo/teams.json under '
                   f'"{year}" > "teams" as "team id": "manager id" ({", ".join(m["id"] for m in managers)}):\n{rows}')
    return got, saved, True


def read_teams(tok, key):
    root = get(tok, f'league/{key}/teams')
    out = []
    for t in root.iter('team'):
        out.append({'id': txt(t, 'team_id'), 'name': txt(t, 'name', ''),
                    'nicks': [txt(m, 'nickname', '') for m in t.iter('manager') if txt(m, 'nickname')]})
    return out


# --- rosters and moves -----------------------------------------------------------------------------

# Defenses go by their nickname ("Jets"), as Yahoo's pages and league.json's drafts and moves write them.
NICKS = {'ARI': 'Cardinals', 'ATL': 'Falcons', 'BAL': 'Ravens', 'BUF': 'Bills', 'CAR': 'Panthers', 'CHI': 'Bears',
         'CIN': 'Bengals', 'CLE': 'Browns', 'DAL': 'Cowboys', 'DEN': 'Broncos', 'DET': 'Lions', 'GB': 'Packers',
         'HOU': 'Texans', 'IND': 'Colts', 'JAX': 'Jaguars', 'KC': 'Chiefs', 'LV': 'Raiders', 'LAC': 'Chargers',
         'LAR': 'Rams', 'MIA': 'Dolphins', 'MIN': 'Vikings', 'NE': 'Patriots', 'NO': 'Saints', 'NYG': 'Giants',
         'NYJ': 'Jets', 'PHI': 'Eagles', 'PIT': 'Steelers', 'SF': '49ers', 'SEA': 'Seahawks', 'TB': 'Buccaneers',
         'TEN': 'Titans', 'WAS': 'Commanders', 'WSH': 'Commanders'}
try:
    from zoneinfo import ZoneInfo
    EAST = ZoneInfo('America/New_York')
except Exception:  # no time zone data: Eastern standard time is close enough to order moves and pick their week
    EAST = datetime.timezone(datetime.timedelta(hours=-5))


def player_of(p):
    """(name, position) of a Yahoo player element."""
    pos = (txt(p, 'display_position', '') or '').split(',')[0]
    name = txt(p, 'name/full', '')
    if pos == 'DEF' or txt(p, 'position_type') == 'DT':
        team = txt(p, 'editorial_team_full_name')
        name = team.split(' ')[-1] if team else NICKS.get((txt(p, 'editorial_team_abbr') or '').upper(), name)
        pos = 'DEF'
    return name, pos


def team_id(key):
    return (key or '').rsplit('.t.', 1)[-1] if key and '.t.' in key else None


def read_rosters(tok, key, ids):
    """{manager id: [[name, position, NFL team, lineup slot], ...]} as the rosters stand now."""
    out = {}
    for t in get(tok, f'league/{key}/teams/roster').iter('team'):
        m = ids.get(txt(t, 'team_id'))
        if not m:
            continue
        out[m] = [[*player_of(p), (txt(p, 'editorial_team_abbr') or '').upper(), txt(p, 'selected_position/position', '')]
                  for p in t.iter('player')]
    return out


def read_weeks(tok, key):
    """[(week, first day, last day)] of the NFL season, days as YYYY-MM-DD."""
    root = get(tok, f"game/{key.split('.l.')[0]}/game_weeks")
    return sorted((int(txt(w, 'week')), txt(w, 'start', ''), txt(w, 'end', '')) for w in root.iter('game_week')
                  if txt(w, 'week'))


def read_transactions(tok, key):
    """Every transaction of the season, newest first, 25 to a page."""
    out, seen, start = [], set(), 0
    while True:
        try:
            page = list(get(tok, f'league/{key}/transactions;start={start};count=25').iter('transaction'))
        except Stop:
            if start:
                raise
            return list(get(tok, f'league/{key}/transactions').iter('transaction'))
        new = [t for t in page if txt(t, 'transaction_key') not in seen]
        seen.update(txt(t, 'transaction_key') for t in new)
        out += new
        if len(page) < 25 or not new:
            return out
        start += len(page)


def moves_of(trans, ids, weeks, year):
    """(pickups, drops, trades) in league.json's shapes, from Yahoo's successful adds, drops and trades."""
    picks, drops, trades = [], [], []
    for t in trans:
        kind = txt(t, 'type', '')
        if txt(t, 'status') != 'successful' or kind not in ('add', 'drop', 'add/drop', 'trade'):
            continue
        when = datetime.datetime.fromtimestamp(int(txt(t, 'timestamp', '0')), EAST)
        day = when.strftime('%Y-%m-%d')
        week = max([w for w, first, _ in weeks if first <= day] or [weeks[0][0] if weeks else 1])
        base = {'year': year, 'week': week, 'at': when.strftime('%Y-%m-%dT%H:%M')}
        if kind == 'trade':
            got = {}
            for p in t.iter('player'):
                m = ids.get(team_id(txt(p, 'transaction_data/destination_team_key')))
                if m:
                    got.setdefault(m, []).append(player_of(p)[0])
            if len(got) >= 2:
                trades.append({'year': year, 'week': week, 'date': f'{when:%b} {when.day}', 'at': base['at'],
                               'sides': [{'manager': m, 'got': g} for m, g in got.items()]})
            continue
        for p in t.iter('player'):
            d = p.find('transaction_data')
            if d is None:
                continue
            name, pos = player_of(p)
            if txt(d, 'type') == 'add':
                m = ids.get(team_id(txt(d, 'destination_team_key')))
                if m:
                    row = dict(base, manager=m, player=name, pos=pos,
                               how='waivers' if txt(d, 'source_type') == 'waivers' else 'FA')
                    bid = txt(t, 'faab_bid')
                    if row['how'] == 'waivers' and bid and bid.isdigit():
                        row['faab'] = int(bid)
                    picks.append(row)
            elif txt(d, 'type') == 'drop':
                m = ids.get(team_id(txt(d, 'source_team_key')))
                if m:
                    drops.append(dict(base, manager=m, player=name, pos=pos))
    return picks, drops, trades


def trade_at(t):
    if t.get('at'):
        return t['at']
    try:
        return datetime.datetime.strptime(f"{t.get('date')} {t.get('year')}", '%b %d %Y').strftime('%Y-%m-%dT00:00')
    except ValueError:
        return ''


def merge(old, new, year, key, at):
    """This season's moves: Yahoo's, plus the ones on file from before the oldest Yahoo returned and not among them
    (so a short list from Yahoo never loses moves entered by hand). Other seasons stay as they are."""
    if not new:
        return old
    first, have = min(at(x) for x in new), {key(x) for x in new}
    keep = [x for x in old if x.get('year') != year or (at(x) < first and key(x) not in have)]
    mine = sorted([x for x in keep if x.get('year') == year] + new, key=at)
    return [x for x in keep if x.get('year') != year] + mine


def sync_moves(tok, key, data, season, ids, year, week):
    """Rosters and moves into data; returns what changed (['rosters', 'moves']). A failure here only warns."""
    changed = []
    try:
        teams = read_rosters(tok, key, ids)
        old = season.get('rosters') or {}
        if teams and (old.get('teams') != teams or old.get('week') != week):
            season['rosters'] = {'at': datetime.datetime.now(EAST).strftime('%Y-%m-%dT%H:%M'), 'week': week, 'teams': teams}
            changed.append('rosters')
    except Waiting:
        raise
    except Exception as e:  # Stop, or an answer shaped unlike the ones this was written for: the scores still sync
        print(f'::warning::Rosters not synced: {e}')
    try:
        picks, drops, trades = moves_of(read_transactions(tok, key), ids, read_weeks(tok, key), year)
        mv = lambda x: (x.get('manager'), squash(x.get('player')))
        deal = lambda t: tuple(sorted((s.get('manager'), tuple(sorted(map(squash, s.get('got') or [])))) for s in t.get('sides') or []))
        for k, new, kf, at in (('pickups', picks, mv, lambda x: x.get('at') or ''), ('drops', drops, mv, lambda x: x.get('at') or ''),
                               ('trades', trades, deal, trade_at)):
            got = merge(data.get(k) or [], new, year, kf, at)
            if got != (data.get(k) or []):
                data[k] = got
                if 'moves' not in changed:
                    changed.append('moves')
    except Waiting:
        raise
    except Exception as e:
        print(f'::warning::Transactions not synced: {e}')
    return changed


# --- the sync --------------------------------------------------------------------------------------

ROUNDS = ['final', 'semi', 'quarter']


def playoff_types(games, week, end, out, semi):
    """Name each playoff game like past seasons. A game is in the title bracket unless Yahoo calls it consolation
    or a team in it already lost a title-bracket game (`out`); in the last week the semifinal winners play the
    final and its losers the third-place game. `semi` holds the semifinals as {(winner, loser)}."""
    left = end - week
    rnd = ROUNDS[left] if left < len(ROUNDS) else 'quarter'
    won = {w for w, _ in semi}
    lost = {l for _, l in semi}
    for g in games:
        pair = {g['a'], g['b']}
        if rnd == 'final' and won:
            g['type'] = 'final' if pair <= won else 'third' if pair <= lost else 'consol'
        elif g['consol'] or pair & out:
            g['type'] = 'consol'
        else:
            g['type'] = rnd


def orient(pairs, w, a, b):
    """Keep a game's a/b order as league.json already has it."""
    return (b, a) if (w, b, a) in pairs and (w, a, b) not in pairs else (a, b)


def sync():
    with open(LEAGUE_FILE, encoding='utf-8') as f:
        before = f.read()
    data = json.loads(before)
    tok = access_token()
    key = find_league(tok, data.get('league', {}).get('name', ''))
    root = get(tok, f'league/{key}/settings')
    lg = root.find('league')
    year = int(txt(lg, 'season'))
    cur_w, start_w, end_w = int(txt(lg, 'current_week', 1)), int(txt(lg, 'start_week', 1)), int(txt(lg, 'end_week', 17))
    po_start = int(txt(lg, 'settings/playoff_start_week', end_w + 1) or end_w + 1)
    finished = txt(lg, 'is_finished') == '1'

    season = next((s for s in data['seasons'] if s.get('year') == year), None)
    yteams = read_teams(tok, key)
    ids, saved, new_map = match_teams(data, season, yteams, year)
    if season is None:
        season = {'year': year, 'teams': {}, 'matchups': [], 'inProgress': True, 'schedule': []}
        data['seasons'].append(season)

    for t in yteams:
        season.setdefault('teams', {})[ids[t['id']]] = t['name']
    for m in data['managers']:
        mine = [t['name'] for t in yteams if ids[t['id']] == m['id']]
        if mine:
            m['team'] = mine[0]

    old = season.get('matchups') or []
    pairs = {(g['week'], g['a'], g['b']) for g in old + (season.get('schedule') or [])}
    by_week = {}
    last_w = cur_w if cur_w >= po_start else max(cur_w, po_start - 1)
    for w in range(start_w, min(end_w, last_w) + 1):
        by_week[w] = read_week(tok, key, w)

    done, sched, out, semi = {}, [], set(), set()
    for w in sorted(by_week):
        games = by_week[w]
        if games and all(g['status'] == 'postevent' for g in games):
            rows = []
            for g in games:
                t1, t2 = g['teams']
                a, b = orient(pairs, w, ids[t1['id']], ids[t2['id']])
                sa, sb = (t1['pts'], t2['pts']) if a == ids[t1['id']] else (t2['pts'], t1['pts'])
                rows.append({'week': w, 'type': 'reg', 'a': a, 'b': b, 'sa': sa, 'sb': sb, 'consol': g['consol']})
            if w >= po_start:
                playoff_types(rows, w, end_w, out, semi)
            for r in rows:
                win, lose = (r['a'], r['b']) if r['sa'] >= r['sb'] else (r['b'], r['a'])
                if r['type'] in ('quarter', 'semi'):
                    out.add(lose)
                if r['type'] == 'semi':
                    semi.add((win, lose))
            done[w] = [{k: r[k] for k in ('week', 'type', 'a', 'b', 'sa', 'sb')} for r in rows]
        elif games and w < po_start:
            for g in games:
                t1, t2 = g['teams']
                a, b = orient(pairs, w, ids[t1['id']], ids[t2['id']])
                e = {'week': w, 'a': a, 'b': b}
                if w == cur_w and t1['proj'] is not None and t2['proj'] is not None:
                    flip = a != ids[t1['id']]
                    ta, tb = (t2, t1) if flip else (t1, t2)
                    e.update(pa=ta['proj'], pb=tb['proj'])
                    if ta['win'] is not None:
                        e['wa'] = round(ta['win'] * 100, 1)
                sched.append(e)

    keep = [g for g in old if g['week'] not in done]
    season['matchups'] = sorted(keep + [g for w in sorted(done) for g in done[w]], key=lambda g: g['week'])
    fetched = set(by_week)
    future = [g for g in season.get('schedule') or [] if g['week'] not in fetched and g['week'] not in done]
    season['schedule'] = sorted(future + sched, key=lambda g: g['week'])
    season['inProgress'] = not finished
    extras = sync_moves(tok, key, data, season, ids, year, cur_w)

    after = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    changed = after != before
    if changed:
        with open(LEAGUE_FILE, 'w', encoding='utf-8') as f:
            f.write(after)
    if new_map:
        saved[str(year)] = {'league': key, 'teams': dict(sorted(ids.items(), key=lambda kv: int(kv[0])))}
        with open(TEAMS_FILE, 'w', encoding='utf-8') as f:
            json.dump(saved, f, indent=2, ensure_ascii=False)
            f.write('\n')

    finals = sorted(done)
    old_weeks = {g['week'] for g in old}
    new_weeks = [w for w in finals if w not in old_weeks]
    proj = any('pa' in e for e in sched)
    bits = []
    if new_weeks:
        bits.append('week ' + ', '.join(map(str, new_weeks)) + ' final' + ('s' if len(new_weeks) > 1 else ''))
    if proj:
        bits.append(f'week {cur_w} projections')
    bits += [{'rosters': 'rosters', 'moves': 'transactions'}[x] for x in extras]
    msg = 'Yahoo: ' + (', '.join(bits) if bits else 'score and schedule updates') if changed else ''
    print(f'{year} league {key}: finished weeks {finals[0] if finals else "-"}-{finals[-1] if finals else "-"}, '
          f'current week {cur_w}, ' + ('league.json updated' if changed else 'no changes'))
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a', encoding='utf-8') as f:
            f.write(f'message={msg}\n')
    return msg


def main(argv):
    cmd = argv[1] if len(argv) > 1 else 'sync'
    if cmd == 'link':
        q = urllib.parse.urlencode({'client_id': env('YAHOO_CLIENT_ID'), 'redirect_uri': REDIRECT,
                                    'response_type': 'code', 'language': 'en-us'})
        print(f'{AUTH}/request_auth?{q}')
    elif cmd == 'connect':
        code = (argv[2] if len(argv) > 2 else os.environ.get('YAHOO_CODE', '')).strip()
        if 'code=' in code:  # the whole address Yahoo sent the browser to
            code = urllib.parse.parse_qs(urllib.parse.urlsplit(code).query).get('code', [''])[0]
        if not code:
            raise Stop('No sign-in code given.')
        j = token_call({'grant_type': 'authorization_code', 'code': code, 'redirect_uri': REDIRECT})
        save_refresh(j['refresh_token'])
        print('Yahoo connected.')
    elif cmd == 'sync':
        sync()
    else:
        raise Stop(f'Unknown command {cmd}: use link, connect or sync.')


if __name__ == '__main__':
    try:
        main(sys.argv)
    except Waiting as e:
        print(f'::warning::{e}')
        summary = os.environ.get('GITHUB_STEP_SUMMARY')
        if summary:
            with open(summary, 'a', encoding='utf-8') as f:
                f.write(f'### Waiting on Yahoo\n{e}\n')
    except Stop as e:
        print(f'::error::{str(e).splitlines()[0]}')
        print(e, file=sys.stderr)
        sys.exit(1)
