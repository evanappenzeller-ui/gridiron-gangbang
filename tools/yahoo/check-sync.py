#!/usr/bin/env python3
"""Checks sync.py against a stand-in Yahoo (a local server with canned answers), on a copy of data/league.json.

  python3 tools/yahoo/check-sync.py

Covers the rosters and the moves (pickups, drops, trades): two pages of transactions, waiver bids, defenses by
nickname, the week a move falls in, moves on file from before Yahoo's oldest kept, a second run changing nothing,
and Yahoo refusing the transactions (the run warns and still passes). Prints "ok" or what went wrong.
"""
import datetime
import http.server
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
KEY = '461.l.999'
EAST = ZoneInfo('America/New_York')
league = json.load(open(os.path.join(REPO, 'data', 'league.json'), encoding='utf-8'))
MGRS = [m['id'] for m in league['managers']]
TID = {m: str(i + 1) for i, m in enumerate(MGRS)}  # Yahoo team id of each manager
FAIL = set()


def ts(day, hm='12:00'):
    return int(datetime.datetime.fromisoformat(f'{day}T{hm}').replace(tzinfo=EAST).timestamp())


def player(name, pos='WR', abbr='Buf', data=''):
    ptype = 'DT' if pos == 'DEF' else 'O'
    return (f'<player><name><full>{name}</full></name><editorial_team_abbr>{abbr}</editorial_team_abbr>'
            f'<display_position>{pos}</display_position><position_type>{ptype}</position_type>{data}</player>')


def add(mgr, src='freeagents'):
    return (f'<transaction_data><type>add</type><source_type>{src}</source_type><destination_type>team</destination_type>'
            f'<destination_team_key>{KEY}.t.{TID[mgr]}</destination_team_key></transaction_data>')


def drop(mgr):
    return (f'<transaction_data><type>drop</type><source_type>team</source_type><source_team_key>{KEY}.t.{TID[mgr]}'
            f'</source_team_key><destination_type>waivers</destination_type></transaction_data>')


def trade_to(frm, to):
    return (f'<transaction_data><type>trade</type><source_team_key>{KEY}.t.{TID[frm]}</source_team_key>'
            f'<destination_team_key>{KEY}.t.{TID[to]}</destination_team_key></transaction_data>')


A, B = MGRS[0], MGRS[1]
TRANS = []  # oldest first here; served newest first
for i in range(26):  # filler free-agent pickups, Oct 16 to Oct 23, so the list runs to two pages
    TRANS.append(('add', ts(f'2026-10-{16 + i // 4:02d}', f'{10 + i % 4}:00'), '', player(f'Filler Guy{i}', 'RB', data=add(A))))
TRANS += [
    ('add/drop', ts('2026-10-21', '03:00'), '<faab_bid>7</faab_bid>',
     player('Waiver Wire', 'WR,TE', data=add(B, 'waivers')) + player('Cut Loose', 'TE', data=drop(B))),
    ('drop', ts('2026-10-26', '20:00'), '', player('Monday Drop', 'QB', data=drop(A))),
    ('drop', ts('2026-10-27', '06:00'), '', player('Tuesday Drop', 'K', data=drop(A))),
    ('add', ts('2026-10-27', '07:00'), '', player('New York', 'DEF', 'NYJ', data=add(B))),
    ('trade', ts('2026-10-22', '18:30'), '', player('Swap One', 'RB', data=trade_to(A, B)) + player('Swap Two', 'WR', data=trade_to(B, A))),
    ('commish', ts('2026-10-24'), '', player('Commish Move', 'RB', data=add(A))),
    ('add', ts('2026-10-25'), '', player('Never Happened', 'RB', data=add(A))),  # served with status failed
]


def trans_xml(start, count):
    rows = sorted(TRANS, key=lambda t: -t[1])
    out = []
    for i, (kind, t, extra, players) in enumerate(rows[start:start + count]):
        status = 'failed' if 'Never Happened' in players else 'successful'
        out.append(f'<transaction><transaction_key>{KEY}.tr.{start + i}</transaction_key><type>{kind}</type>'
                   f'<status>{status}</status><timestamp>{t}</timestamp>{extra}<players>{players}</players></transaction>')
    return f'<league><transactions>{"".join(out)}</transactions></league>'


def weeks_xml():
    rows = ['<game_week><week>1</week><start>2026-09-10</start><end>2026-09-14</end></game_week>']
    for w in range(2, 19):
        s = datetime.date(2026, 9, 15) + datetime.timedelta(days=7 * (w - 2))
        rows.append(f'<game_week><week>{w}</week><start>{s}</start><end>{s + datetime.timedelta(days=6)}</end></game_week>')
    return f'<game><game_weeks>{"".join(rows)}</game_weeks></game>'


SEASON = next(s for s in league['seasons'] if s['year'] == 2026)
ROSTERS = {A: [('Josh Allen', 'QB', 'Buf', 'QB'), ('Swap Two', 'WR', 'Det', 'BN')], B: [('New York', 'DEF', 'NYJ', 'DEF')]}


def answer(path):
    if '/transactions' in path:
        if 'transactions' in FAIL:
            return None
        q = dict(x.split('=', 1) for x in path.split(';')[1:] if '=' in x)
        return trans_xml(int(q.get('start', 0)), int(q.get('count', 25)))
    if path.endswith('/settings'):
        return ('<league><season>2026</season><current_week>8</current_week><start_week>1</start_week><end_week>17</end_week>'
                '<is_finished>0</is_finished><settings><playoff_start_week>15</playoff_start_week></settings></league>')
    if path.endswith('/teams/roster'):
        teams = ''.join(f'<team><team_id>{TID[m]}</team_id><roster><players>' + ''.join(
            player(n, p, ab, f'<selected_position><position>{slot}</position></selected_position>') for n, p, ab, slot in ROSTERS.get(m, []))
            + '</players></roster></team>' for m in MGRS)
        return f'<league><teams>{teams}</teams></league>'
    if path.endswith('/teams'):
        return '<league><teams>' + ''.join(f'<team><team_id>{TID[m]}</team_id><name>{escape(SEASON["teams"].get(m, m))}</name></team>'
                                           for m in MGRS) + '</teams></league>'
    if '/scoreboard' in path:
        return '<league><scoreboard><matchups></matchups></scoreboard></league>'
    if path.endswith('/game_weeks'):
        return weeks_xml()
    return None


class Yahoo(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, body, kind):
        b = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length') or 0))
        self.reply(200, json.dumps({'access_token': 'a', 'refresh_token': 'r'}), 'application/json')

    def do_GET(self):
        body = answer(self.path.split('/v2/', 1)[-1])
        if body is None:
            return self.reply(500, '<error><description>Something broke</description></error>', 'text/xml')
        self.reply(200, f'<?xml version="1.0"?><fantasy_content xmlns="http://fantasysports.yahooapis.com/fantasy/v2/base.rng">{body}</fantasy_content>', 'text/xml')


def main():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Yahoo)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{srv.server_port}'
    root = tempfile.mkdtemp()
    bad = []
    try:
        os.makedirs(os.path.join(root, 'data'))
        os.makedirs(os.path.join(root, 'tools', 'yahoo'))
        shutil.copy(os.path.join(REPO, 'data', 'league.json'), os.path.join(root, 'data', 'league.json'))
        with open(os.path.join(root, 'tools', 'yahoo', 'teams.json'), 'w') as f:
            json.dump({'2026': {'league': KEY, 'teams': {TID[m]: m for m in MGRS}}}, f)
        out = os.path.join(root, 'out.txt')
        env = dict(os.environ, YAHOO_ROOT=root, YAHOO_AUTH_BASE=base + '/oauth2', YAHOO_API_BASE=base + '/v2',
                   YAHOO_CLIENT_ID='id', YAHOO_CLIENT_SECRET='secret', YAHOO_LEAGUE_ID=KEY, GITHUB_OUTPUT=out)
        env.pop('GITHUB_STEP_SUMMARY', None)

        def run(*args):
            open(out, 'w').close()
            p = subprocess.run([sys.executable, os.path.join(HERE, 'sync.py'), *args], env=env, capture_output=True, text=True)
            if p.returncode:
                bad.append(f'sync.py {" ".join(args)} failed: {p.stdout}{p.stderr}')
            return p.stdout + p.stderr, open(out).read()

        def load():
            return json.load(open(os.path.join(root, 'data', 'league.json'), encoding='utf-8'))

        run('connect', 'code')
        before = load()
        log, msg = run('sync')
        d = load()
        mine = lambda k: [x for x in d[k] if x['year'] == 2026]
        pk = {x['player']: x for x in mine('pickups')}
        dr = {x['player']: x for x in mine('drops')}
        if 'rosters' not in msg or 'transactions' not in msg:
            bad.append(f'commit message: {msg.strip()}')
        if sum(1 for x in pk if x.startswith('Filler Guy')) != 26:
            bad.append(f'both pages of moves: {sum(1 for x in pk if x.startswith("Filler Guy"))} fillers (want 26)')
        w = pk.get('Waiver Wire') or {}
        if (w.get('manager'), w.get('how'), w.get('faab'), w.get('pos'), w.get('week'), w.get('at')) != (B, 'waivers', 7, 'WR', 7, '2026-10-21T03:00'):
            bad.append(f'waiver claim: {w}')
        if (dr.get('Cut Loose') or {}).get('manager') != B:
            bad.append(f'add/drop drop: {dr.get("Cut Loose")}')
        if (dr.get('Monday Drop') or {}).get('week') != 7 or (dr.get('Tuesday Drop') or {}).get('week') != 8:
            bad.append(f'weeks run Tuesday to Monday: {dr.get("Monday Drop")}, {dr.get("Tuesday Drop")}')
        j = pk.get('Jets') or {}
        if (j.get('pos'), j.get('manager'), j.get('how')) != ('DEF', B, 'FA'):
            bad.append(f'defense by nickname: {j}')
        if 'Commish Move' in pk or 'Never Happened' in pk:
            bad.append('commissioner or failed moves kept')
        old15 = [x['player'] for x in before['pickups'] if x['year'] == 2026 and x['at'] < '2026-10-16']
        later = [x['player'] for x in before['pickups'] if x['year'] == 2026 and x['at'] >= '2026-10-16T10:00' and x['player'] != 'Jets']
        if not old15 or any(p not in pk for p in old15):
            bad.append(f'moves on file before Yahoo\'s oldest kept: {old15}')
        if any(p in pk for p in later):
            bad.append(f'moves on file in Yahoo\'s span replaced: {[p for p in later if p in pk]}')
        tr = mine('trades')
        if len(tr) != 1 or tr[0]['date'] != 'Oct 22' or tr[0]['week'] != 7 or tr[0]['at'] != '2026-10-22T18:30' or \
                {s['manager']: s['got'] for s in tr[0]['sides']} != {A: ['Swap Two'], B: ['Swap One']}:
            bad.append(f'trade: {tr}')
        if [x for x in d['trades'] if x['year'] != 2026] != [x for x in before['trades'] if x['year'] != 2026]:
            bad.append('other seasons\' trades changed')
        ro = next(s for s in d['seasons'] if s['year'] == 2026).get('rosters') or {}
        if ro.get('teams', {}).get(A) != [['Josh Allen', 'QB', 'BUF', 'QB'], ['Swap Two', 'WR', 'DET', 'BN']] or \
                ro.get('teams', {}).get(B) != [['Jets', 'DEF', 'NYJ', 'DEF']] or len(ro.get('at', '')) != 16:
            bad.append(f'rosters: {ro}')
        if pk and list(d['pickups']) != sorted(d['pickups'], key=lambda x: (x['year'], x['at'])):
            bad.append('pickups out of order')

        same = json.dumps(load())
        log2, msg2 = run('sync')
        if json.dumps(load()) != same or msg2.strip() != 'message=':
            bad.append(f'a second run changed the file: {msg2.strip()}')

        FAIL.add('transactions')
        ROSTERS[A].append(('Late Add', 'RB', 'Mia', 'BN'))
        log3, msg3 = run('sync')
        d3 = load()
        if 'Transactions not synced' not in log3 or d3['pickups'] != d['pickups'] or 'rosters' not in msg3 or 'transactions' in msg3:
            bad.append(f'Yahoo refusing the transactions: {log3.strip()} / {msg3.strip()}')
    finally:
        srv.shutdown()
        shutil.rmtree(root, ignore_errors=True)
    print('\n'.join(bad) if bad else 'ok')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
