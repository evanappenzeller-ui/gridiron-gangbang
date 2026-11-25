#!/usr/bin/env python3
"""Builds data/trivia-v6.json: the daily trivia's levels from November 26, 2026 on (Evan, Nov 25 2026: "Provide a bunch
of new levels and ensure that no game is repeated ... Include a new feature that allows players to do a bonus puzzle").

Every level is used once, in order, one day after another (js/core/daily.js freshDay), so no game repeats:
  hl      Higher or Lower days: 4 career-stat match-ups (same position and stat), from data/puzzles-v4.json's career lines
          (PZ.N, regular season), retired players only (their totals are final).
  conn    Team Connections days: 3 groups of 3 players (drafted by a franchise, college, first overall pick, shared
          first name), every player fitting only his own group.
  num     Number Trivia days: 2 questions (a career total, a draft pick, or a hand-checked record), each with its own
          scale that never centres on the answer.
  bonus   The bonus puzzle, a kind a day in turn: wheel (a Wordscapes letter wheel: every common word in the letters),
          cross (a criss-cross mini crossword of teams, players and football words), scramble (4 words: a player, a
          team, a coach, a player) and score (3 games of the 2026 season: match the 6 final scores to the teams).
  classic College / Mystery / Journey / Grid source days (indexes into puzzles-v4.json days) never played before:
          not days 1-46 (played as themselves) nor the ones days 47-59 borrowed; their mystery and journey players
          not seen before either.

Usage: python3 tools/puzzles/trivia_v6.py <dir with ESPN 2026 scoreboards w1.json..wN.json>
(append-only: rerun it with later weeks' scoreboards to add Score Match levels; nothing already in the file moves)
Needs: pip install wordfreq english-words. Deterministic (fixed seeds).
"""
import json, random, re, sys, os, math, itertools
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PZ = json.load(open(os.path.join(ROOT, 'data/puzzles-v4.json')))
P, N, T = PZ['P'], PZ['N'], PZ['teams']
TA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef'
SK = ['pass_yards', 'pass_tds', 'pass_ints', 'rush_yards', 'rush_tds', 'receptions', 'rec_yards', 'rec_tds', 'def_sacks', 'def_ints', 'games']
POSN = {'QB': 'QB', 'RB': 'RB', 'WR': 'WR', 'TE': 'TE', 'DL': 'DL', 'LB': 'LB', 'DB': 'DB'}
POSW = {'QB': 'quarterback', 'RB': 'running back', 'WR': 'wide receiver', 'TE': 'tight end', 'DL': 'defensive lineman', 'LB': 'linebacker', 'DB': 'defensive back'}
DAYS = 420  # levels per daily game: more than a year

def teams_of(i): return [T[TA.index(c)] for c in P[i][1]]
def years(i): return f'{P[i][4]}–{P[i][5]}' if P[i][4] != P[i][5] else str(P[i][4])
def and_list(a): return a[0] if len(a) == 1 else ' and '.join(a) if len(a) == 2 else ', '.join(a[:-1]) + ', and ' + a[-1]
def st(i, k): return N[str(i)][7][SK.index(k)]

STARS = [int(k) for k in N]
retired = lambda i: P[i][5] <= 2025
hof = lambda i: N[str(i)][6] == 1
# How well known: tier 2 (stat games, connections), tier 1 (names to spell: crossword, unscramble, draft-pick questions)
known = lambda i: hof(i) or P[i][7] >= 26 or (P[i][5] >= 2012 and P[i][7] >= 20)
star = lambda i: hof(i) or P[i][7] >= 40 or (P[i][5] >= 2015 and P[i][7] >= 25)
names = defaultdict(list)
for i in STARS: names[P[i][0]].append(i)
STARS = [i for i in STARS if len(names[P[i][0]]) == 1]  # one star by that name

def sub(i): return f"{POSN[P[i][2]]} · {and_list(teams_of(i)[:3])} · {years(i)}"

# ------------------------------------------------------------------------------------------------ Higher or Lower
CATS = {
    'QB': [('pass_yards', 'Career passing yards', 15000), ('pass_tds', 'Career touchdown passes', 100), ('rush_yards', 'Career rushing yards by a QB', 1500)],
    'RB': [('rush_yards', 'Career rushing yards', 5000), ('rush_tds', 'Career rushing touchdowns', 35), ('receptions', 'Career catches by a running back', 200)],
    'WR': [('receptions', 'Career catches', 400), ('rec_yards', 'Career receiving yards', 6000), ('rec_tds', 'Career touchdown catches', 40)],
    'TE': [('receptions', 'Career catches by a tight end', 300), ('rec_yards', 'Career receiving yards by a tight end', 3500), ('rec_tds', 'Career touchdown catches by a tight end', 25)],
    'DL': [('def_sacks', 'Career sacks', 40)],
    'LB': [('def_sacks', 'Career sacks by a linebacker', 25)],
    'DB': [('def_ints', 'Career interceptions', 20)],
}
def eligible(i, k, lo):
    p = P[i]
    if not retired(i) or not known(i): return False
    if k == 'def_sacks' and p[4] < 1982: return False  # sacks are official from 1982
    return st(i, k) >= lo

def build_hl(rng):
    pairs = []
    for pos, cats in CATS.items():
        for k, label, lo in cats:
            pool = [i for i in STARS if P[i][2] == pos and eligible(i, k, lo)]
            for a, b in itertools.combinations(pool, 2):
                va, vb = st(a, k), st(b, k)
                if va == vb or abs(va - vb) / max(va, vb) < .05: continue
                pairs.append((label, k, a, b))
    rng.shuffle(pairs)
    days, used_pairs, uses = [], set(), defaultdict(int)
    it = iter(pairs)
    pending = list(pairs)
    while len(days) < DAYS and pending:
        day, seen, cats = [], set(), set()
        rest = []
        for pr in pending:
            label, k, a, b = pr
            if len(day) < 4 and a not in seen and b not in seen and label not in cats and uses[a] < 6 and uses[b] < 6:
                flip = rng.random() < .5
                x, y = (b, a) if flip else (a, b)
                day.append([label, P[x][0], st(x, k), sub(x), P[y][0], st(y, k), sub(y)])
                seen |= {a, b}; cats.add(label); uses[a] += 1; uses[b] += 1
            else: rest.append(pr)
        pending = rest
        if len(day) < 4: break
        days.append(day)
    return days

# ------------------------------------------------------------------------------------------------ Team Connections
def drafted(i):
    n = N[str(i)]
    if not isinstance(n[0], int): return None
    if not n[1] or not n[2] or n[3] is None or n[3] >= 32: return None
    team, yr = T[n[3]], n[0]
    # Relocated franchises: name the team only for drafts under that name
    if team == 'Titans' and yr < 1997: return None
    if team == 'Ravens' and yr < 1996: return None
    if team == 'Browns' and 1996 <= yr <= 1998: return None
    if team == 'Texans' and yr < 2002: return None
    return team
CRIT = {}
for i in STARS:
    if not known(i): continue
    d = drafted(i)
    if d: CRIT.setdefault(('draft', d), set()).add(i)
    col = N[str(i)][8]
    if col: CRIT.setdefault(('col', col), set()).add(i)
    if N[str(i)][2] == 1 and isinstance(N[str(i)][0], int): CRIT.setdefault(('first', ''), set()).add(i)
    first = P[i][0].split()[0]
    CRIT.setdefault(('name', first), set()).add(i)
CRIT = {c: s for c, s in CRIT.items() if len(s) >= 4}
def fits(i, c):
    return i in CRIT[c]
def clabel(c):
    k, v = c
    return {'draft': f'Drafted by the {v}' if v != 'Washington' else 'Drafted by Washington', 'col': f'Played college ball at {v}',
            'first': 'Drafted first overall', 'name': f'First name: {v}'}[k]

def build_conn(rng):
    crits = list(CRIT)
    out, seen = [], set()
    recent = []  # players in the last 12 sets are rested
    tries = 0
    while len(out) < DAYS and tries < 400000:
        tries += 1
        kinds = rng.choice([('draft', 'draft', 'col'), ('draft', 'col', 'col'), ('draft', 'draft', 'draft'), ('col', 'col', 'col'),
                            ('draft', 'col', 'first'), ('draft', 'col', 'name'), ('col', 'draft', 'name'), ('draft', 'draft', 'col')])
        cs = []
        for k in kinds:
            opts = [c for c in crits if c[0] == k and c not in cs]
            if not opts: break
            cs.append(rng.choice(opts))
        if len(cs) < 3: continue
        groups, used, ok = [], set(), True
        for c in cs:
            rest = set(itertools.chain.from_iterable(recent[-12:]))
            pool = [i for i in CRIT[c] if i not in used and i not in rest and not any(fits(i, o) for o in cs if o != c)]
            if len(pool) < 3: ok = False; break
            pick = rng.sample(pool, 3)
            used |= set(pick); groups.append([clabel(c), [P[i][0] for i in pick]])
        if not ok: continue
        key = tuple(sorted(tuple(sorted(g[1])) for g in groups))
        ck = tuple(sorted(clabel(c) for c in cs))
        if key in seen or ck in seen: continue
        seen.add(key); seen.add(ck)
        recent.append(used)
        out.append(groups)
    return out

# ------------------------------------------------------------------------------------------------ Number Trivia
def nice_step(v):
    for s in [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]:
        if v / s <= 12: return s
    return 10000
def scale(ans, rng, lo=0, cap=None):
    for _ in range(50):
        f = rng.uniform(1.35, 2.6)
        mx = ans * f
        step = nice_step(mx)
        mx = math.ceil(mx / step) * step
        if cap: mx = min(mx, cap)
        if mx <= ans: continue
        frac = (ans - lo) / (mx - lo)
        if .3 <= frac <= .45 or .55 <= frac <= .8: return lo, mx
    return lo, (cap or math.ceil(ans * 2.2))

QWORD = {'pass_yards': ('How many career passing yards did {n} throw for?', 'yards'),
         'pass_tds': ('How many career touchdown passes did {n} throw?', 'TD passes'),
         'rush_yards': ('How many career rushing yards did {n} gain?', 'yards'),
         'rush_tds': ('How many career rushing touchdowns did {n} score?', 'rushing TDs'),
         'receptions': ('How many career catches did {n} make?', 'catches'),
         'rec_yards': ('How many career receiving yards did {n} gain?', 'yards'),
         'rec_tds': ('How many career touchdown catches did {n} make?', 'TD catches'),
         'def_sacks': ('How many career sacks did {n} record?', 'sacks'),
         'def_ints': ('How many career interceptions did {n} make?', 'interceptions')}
# Hand-checked records (completed seasons; the facts are fixed)
FACTS = [
    ('How many passing yards did Peyton Manning throw for in 2013, the single-season record?', 'yards', 0, 7000, 5477, 'Manning broke Drew Brees’s record by one yard.'),
    ('How many touchdown passes did Peyton Manning throw in 2013?', 'TD passes', 0, 80, 55, 'Still the single-season record.'),
    ('How many rushing yards did Eric Dickerson gain in 1984?', 'yards', 0, 3000, 2105, 'The single-season record.'),
    ('How many rushing yards did Adrian Peterson gain in 2012?', 'yards', 0, 3000, 2097, 'Nine yards short of Dickerson’s record.'),
    ('How many receiving yards did Calvin Johnson gain in 2012?', 'yards', 0, 2500, 1964, 'The single-season record.'),
    ('How many touchdown passes did Tom Brady throw in 2007?', 'TD passes', 0, 70, 50, 'For a 16-0 regular season.'),
    ('How many touchdown catches did Randy Moss make in 2007?', 'TD catches', 0, 40, 23, 'The single-season record.'),
    ('How many touchdowns did LaDainian Tomlinson score in 2006?', 'touchdowns', 0, 50, 31, 'The single-season record (28 rushing, 3 receiving).'),
    ('How many sacks did Michael Strahan record in 2001?', 'sacks', 0, 40, 22, 'Officially 22.5, the record T.J. Watt tied in 2021.'),
    ('How many passing yards did Dan Marino throw for in 1984?', 'yards', 0, 7000, 5084, 'The first 5,000-yard season.'),
    ('How many touchdown passes did Patrick Mahomes throw in 2018, his first season as a starter?', 'TD passes', 0, 75, 50, 'He won MVP.'),
    ('How many regular-season games did the 2007 Patriots win?', 'wins', 0, 20, 16, 'They went 16-0.'),
    ('How many games did the 1972 Dolphins win, playoffs included?', 'wins', 0, 25, 17, 'Still the only perfect season: 17-0.'),
    ('How many Super Bowls did the Pittsburgh Steelers win through the 2024 season?', 'titles', 0, 10, 6, 'IX, X, XIII, XIV, XL and XLIII.'),
    ('How many Super Bowls did the New England Patriots win with Tom Brady?', 'titles', 0, 10, 6, 'Plus one more for Brady in Tampa Bay.'),
    ('How many Super Bowls did Tom Brady win as a player?', 'titles', 0, 12, 7, 'Six with the Patriots, one with the Buccaneers.'),
    ('How many Super Bowls did the San Francisco 49ers win in the 1980s?', 'titles', 0, 10, 4, 'XVI, XIX, XXIII and XXIV.'),
    ('How many consecutive Super Bowls did the Buffalo Bills lose in the early 1990s?', 'Super Bowls', 0, 8, 4, 'XXV through XXVIII.'),
    ('How many yards long was Justin Tucker’s record field goal in 2013?', 'yards', 0, 90, 61, 'Matt Prater (64) and Tucker (66, in 2021) went further later.'),
    ('How long, in yards, was Justin Tucker’s record field goal in 2021?', 'yards', 0, 100, 66, 'Against the Lions, off the crossbar.'),
    ('How many yards long is an NFL field from goal line to goal line?', 'yards', 0, 160, 100, 'Plus two 10-yard end zones.'),
    ('How wide is an NFL field, in feet?', 'feet', 0, 250, 160, '53 1/3 yards.'),
    ('How many players does each team have on the field?', 'players', 0, 25, 11, 'Eleven a side.'),
    ('How many teams play in the NFL?', 'teams', 0, 50, 32, 'Sixteen in each conference.'),
    ('How many teams make the NFL playoffs each season?', 'teams', 0, 32, 14, 'Seven per conference since 2020.'),
    ('How many games does each NFL team play in the regular season?', 'games', 0, 25, 17, 'Seventeen since 2021.'),
    ('How many points is a safety worth?', 'points', 0, 10, 2, 'Plus the ball, on the free kick.'),
    ('In what year was the first Super Bowl played?', 'year', 1950, 1990, 1967, 'Played January 15, 1967: Packers 35, Chiefs 10.'),
    ('How many Super Bowls did Vince Lombardi’s Packers win?', 'titles', 0, 10, 2, 'I and II.'),
    ('How many rushing yards did O.J. Simpson gain in 1973?', 'yards', 0, 3000, 2003, 'The first 2,000-yard season (14 games).'),
]

def build_num(rng):
    qs = []
    for i in STARS:
        if not retired(i) or not known(i): continue
        pos = P[i][2]
        for k, label, lo in CATS.get(pos, []):
            if k == 'def_sacks' and P[i][4] < 1982: continue
            v = st(i, k)
            if v < lo or v != int(v): continue
            v = int(v)
            q, unit = QWORD[k]
            mn, mx = scale(v, rng)
            qs.append([q.format(n=P[i][0]), unit, mn, mx, v, f"{POSW[pos].capitalize()}, {and_list(teams_of(i)[:3])}, {years(i)}."])
        n = N[str(i)]
        if star(i) and isinstance(n[0], int) and n[1] and n[2] and n[1] <= 3 and n[0] >= 1980:
            pick = n[2]
            # the dial spans whole rounds (32 picks each, and a little more), so its size gives nothing away
            mx = 32 * (n[1] + (1 if rng.random() < .5 else 0)) + 8
            if pick > 1: qs.append([f"With which overall pick of the {n[0]} draft was {P[i][0]} chosen?", 'overall pick', 1, mx, pick, f"Round {n[1]}, by the {drafted(i)}." if drafted(i) else f"Round {n[1]}."])
    rng.shuffle(qs)
    facts = [list(f) for f in FACTS]
    rng.shuffle(facts)
    # a hand-checked fact about every third day
    days, fi = [], 0
    pool = list(qs)
    while len(days) < DAYS and len(pool) >= 2:
        a = pool.pop()
        if len(days) % 3 == 1 and fi < len(facts): b = facts[fi]; fi += 1
        else:
            b = pool.pop()
            if b[0].split(' did ')[-1] == a[0].split(' did ')[-1]: pool.insert(0, b); b = pool.pop()
        days.append([a, b])
    return days

# ------------------------------------------------------------------------------------------------ Bonus: word wheel
def word_lists():
    from wordfreq import zipf_frequency
    from english_words import get_english_words_set
    raw = get_english_words_set(['web2'], lower=False, alpha=True)
    common = {w for w in raw if w.islower() and 3 <= len(w) <= 8 and zipf_frequency(w, 'en') >= 3.2}
    BAD = {'sex', 'gay', 'nazi', 'slut', 'cum', 'tit', 'tits', 'damn', 'hell', 'ass', 'arse', 'piss', 'crap', 'shit', 'dick', 'cock', 'whore', 'rape', 'raped', 'rapes', 'kill', 'drug', 'drugs', 'gun', 'guns', 'porn', 'nude', 'jap', 'fag', 'homo', 'negro', 'coon', 'spic', 'kike', 'pussy', 'bitch', 'bastard', 'slave', 'dildo', 'anal', 'anus', 'pee', 'poop', 'sexy', 'teat', 'tat', 'goddam', 'bra', 'nipple'}
    common -= BAD
    return common, zipf_frequency

FOOTBALL_WORDS = ['tackle', 'punter', 'kicker', 'huddle', 'fumble', 'safety', 'center', 'rookie', 'league', 'season', 'playoff', 'helmet',
    'jersey', 'stadium', 'coaches', 'drafted', 'trophy', 'roster', 'snapper', 'spiral', 'target', 'rushing', 'passing', 'blocker', 'lineman',
    'defense', 'offense', 'kickoff', 'lateral', 'screen', 'slants', 'fumbles', 'tackles', 'punted', 'kicked', 'charge', 'blitzes', 'sacked',
    'snapped', 'referee', 'umpire', 'whistle', 'timeout', 'players', 'captain', 'huddles', 'cleats', 'padded', 'goalie', 'points', 'yardage',
    'scored', 'scores', 'stripes', 'tailback', 'fullback', 'receiver', 'wideout', 'running', 'defender', 'rusher', 'linemen', 'kicking',
    'punting', 'rookies', 'leagues', 'seasons', 'trophies', 'rosters', 'targets', 'centers', 'safeties', 'helmets', 'jerseys', 'stadiums',
    'drafts', 'starter', 'starters', 'backup', 'coaching', 'trainer', 'trainers', 'pigskin', 'endzone', 'gridiron', 'sideline', 'tailgate',
    'cheers', 'cheering', 'mascot', 'banner', 'trenches', 'pocket', 'scramble', 'pylon', 'pylons', 'stiffarm', 'spike', 'spiked', 'onside',
    'interior', 'zebras', 'flags', 'penalty', 'holding', 'offside', 'illegal', 'tackled', 'blocked', 'blocking', 'catches', 'catcher', 'reception',
    'audible', 'option', 'counter', 'draw', 'sweep', 'sweeps', 'reverse', 'bootleg', 'shotgun', 'pistol', 'wildcat', 'nickel', 'dime', 'corner',
    'corners', 'linebacker', 'nosetackle', 'tight', 'strong', 'weakside', 'outside', 'inside', 'tackle', 'chains', 'chainsaw', 'measured', 'triumph',
    'victory', 'victories', 'winners', 'losers', 'rivals', 'rivalry', 'contest', 'champion', 'champions', 'title', 'titles', 'parade', 'ringer',
    'trophy', 'medal', 'pennant', 'banners', 'stands', 'bleacher', 'tickets', 'ticket', 'nachos', 'pretzel', 'hotdogs', 'mustard', 'tailgates',
    'grills', 'coolers', 'parking', 'fantasy', 'waivers', 'trades', 'traded', 'contract', 'salary', 'signing', 'agents', 'veteran', 'veterans',
    'retired', 'legends', 'legend', 'honors', 'cleated', 'stretch', 'workout', 'practice', 'training', 'combine', 'sprints', 'dashes', 'bench',
    'shuttle', 'broadjump', 'vertical', 'scouts', 'scouting', 'prospect', 'prospects', 'colleges', 'college', 'senior', 'seniors', 'junior',
    'juniors', 'transfer', 'stadium', 'domes', 'turf', 'grass', 'weather', 'snowy', 'rainy', 'frozen', 'lambeau', 'thunder', 'lightning']

def build_wheel(rng):
    common, zf = word_lists()
    from collections import Counter
    out, seen = [], set()
    bases = sorted(set(w for w in FOOTBALL_WORDS if 6 <= len(w) <= 7 and w.isalpha()))
    for base in bases:
        letters = Counter(base)
        if sum(1 for c in letters if c in 'aeiou') < 2: continue
        words = [w for w in common if len(w) >= 3 and not (Counter(w) - letters)]
        if base not in words and zf(base, 'en') >= 2.5: words.append(base)
        words = sorted(set(words), key=lambda w: (-zf(w, 'en'), w))
        targets = [w for w in words if len(w) >= 3][:14]
        if base in words and base not in targets: targets[-1] = base
        if len(targets) < 6: continue
        key = ''.join(sorted(base))
        if key in seen: continue
        seen.add(key)
        lt = list(base.upper()); rng.shuffle(lt)
        extra = [w for w in words if w not in targets]
        out.append([''.join(lt), sorted([w.upper() for w in targets], key=lambda w: (len(w), w)), [w.upper() for w in extra], base.upper()])
    rng.shuffle(out)
    return out

# ------------------------------------------------------------------------------------------------ Bonus: crossword
CITY = {'Cardinals': 'Arizona', 'Falcons': 'Atlanta', 'Ravens': 'Baltimore', 'Bills': 'Buffalo', 'Panthers': 'Carolina', 'Bears': 'Chicago',
        'Bengals': 'Cincinnati', 'Browns': 'Cleveland', 'Cowboys': 'Dallas', 'Broncos': 'Denver', 'Lions': 'Detroit', 'Packers': 'Green Bay',
        'Texans': 'Houston', 'Colts': 'Indianapolis', 'Jaguars': 'Jacksonville', 'Chiefs': 'Kansas City', 'Raiders': 'Las Vegas',
        'Chargers': 'Los Angeles (AFC)', 'Rams': 'Los Angeles (NFC)', 'Dolphins': 'Miami', 'Vikings': 'Minnesota', 'Patriots': 'New England',
        'Saints': 'New Orleans', 'Giants': 'New York (NFC)', 'Jets': 'New York (AFC)', 'Eagles': 'Philadelphia', 'Steelers': 'Pittsburgh',
        'Seahawks': 'Seattle', 'Buccaneers': 'Tampa Bay', 'Titans': 'Tennessee', 'Commanders': 'Washington'}
TERMS = [('SACK', 'Quarterback takedown behind the line'), ('PUNT', 'Fourth-down kick to flip the field'), ('BLITZ', 'Extra rushers sent at the QB'),
    ('HUDDLE', 'Where the play call is shared'), ('FUMBLE', 'Ball on the ground!'), ('SAFETY', 'Two points for the defense'), ('SNAP', 'Center-to-QB exchange'),
    ('SPIKE', 'Throw it into the turf to stop the clock'), ('KNEEL', 'Victory formation move'), ('AUDIBLE', 'Play changed at the line'),
    ('PYLON', 'Orange marker at the goal line'), ('ENDZONE', 'Where touchdowns are scored'), ('REDZONE', 'Inside the 20'), ('DRAFT', 'April player selection'),
    ('ROOKIE', 'First-year player'), ('HELMET', 'Head protection with a face mask'), ('CLEATS', 'Studded shoes'), ('TACKLE', 'Bring the ball carrier down'),
    ('LATERAL', 'Backward toss'), ('SCREEN', 'Short pass behind a wall of blockers'), ('SLANT', 'Quick diagonal route'), ('POST', 'Deep route toward the goalposts'),
    ('FADE', 'Back-shoulder corner-of-end-zone route'), ('SNEAK', 'QB pushes forward behind the center'), ('OFFSIDE', 'Across the line too early'),
    ('HOLDING', 'Ten-yard grab penalty'), ('FLAG', 'Yellow cloth from an official'), ('ONSIDE', 'Short kickoff the kickers try to recover'),
    ('KICKOFF', 'Play that starts each half'), ('TOUCHBACK', 'Ball downed in the end zone'), ('POCKET', 'Protected area where the QB throws'),
    ('SHOTGUN', 'QB lines up five yards back'), ('BOOTLEG', 'QB rolls out after a fake handoff'), ('NICKEL', 'Defense with five defensive backs'),
    ('DIME', 'Defense with six defensive backs'), ('CENTER', 'Lineman who snaps the ball'), ('GUARD', 'Lineman beside the center'),
    ('TIGHTEND', 'Blocker who also catches passes'), ('WIDEOUT', 'Receiver split out wide'), ('HANDOFF', 'Ball placed in the runner’s belly'),
    ('STIFFARM', 'Ball carrier’s straight-arm shove'), ('JUKE', 'Fake move to make a tackler miss'), ('HAILMARY', 'Desperation heave at the end'),
    ('TWOMINUTE', '___ warning'), ('OVERTIME', 'Extra period after a tie'), ('TIMEOUT', 'Each team gets three a half'), ('GOALPOST', 'Uprights and crossbar'),
    ('UPRIGHT', 'One side of the goalpost'), ('FIELDGOAL', 'Three-point kick'), ('EXTRAPOINT', 'Kick after a touchdown'), ('PIGSKIN', 'Nickname for the ball'),
    ('GRIDIRON', 'Nickname for the field'), ('SIDELINE', 'Where the coaches stand'), ('CHAINS', 'Measure for a first down'), ('DOWN', 'One of four tries'),
    ('YARD', 'Unit of field distance'), ('LOMBARDI', 'Super Bowl trophy namesake'), ('PLAYOFFS', 'Postseason tournament'), ('WILDCARD', 'Opening playoff round'),
    ('MVP', 'Top award for the best player'), ('PROBOWL', 'All-star game'), ('COMBINE', 'Pre-draft workouts in Indianapolis'), ('SCRAMBLE', 'QB runs out of the pocket'),
    ('INTERCEPT', 'Catch a pass meant for the other team'), ('PICKSIX', 'Interception returned for a score'), ('TOUCHDOWN', 'Six points'),
    ('REFEREE', 'Official in the white hat'), ('ZEBRA', 'Slang for an official'), ('PLAYBOOK', 'Team’s book of plays'), ('TRENCHES', 'Where linemen battle')]

def player_words():
    out = []
    for i in STARS:
        if not star(i): continue
        last = P[i][0].split()[-1]
        if last in ('Jr.', 'Sr.', 'II', 'III', 'IV') or not last.isalpha() or not 4 <= len(last) <= 9: continue
        n = N[str(i)]
        first = ' '.join(P[i][0].split()[:-1])
        clue = f"{first} ___, {and_list(teams_of(i)[:2])} {POSW[P[i][2]]} ({years(i) if retired(i) else 'since ' + str(P[i][4])})"
        out.append((last.upper(), clue, i))
    dup = defaultdict(int)
    for w, _, _ in out: dup[w] += 1
    return [x for x in out if dup[x[0]] == 1]  # a surname only one star has

def layout(words, rng, size=10):
    """Criss-cross: every word crosses one already placed; no two words touch otherwise."""
    grid, placed = {}, []
    def fits(w, r, c, d):
        dr, dc = (0, 1) if d == 'a' else (1, 0)
        if r < 0 or c < 0 or r + dr * (len(w) - 1) >= size or c + dc * (len(w) - 1) >= size: return -1
        if (r - dr, c - dc) in grid or (r + dr * len(w), c + dc * len(w)) in grid: return -1
        cross = 0
        for k, ch in enumerate(w):
            rr, cc = r + dr * k, c + dc * k
            g = grid.get((rr, cc))
            if g:
                if g[0] != ch or g[1] == d: return -1
                cross += 1
            else:
                for nr, nc in ((rr + dc, cc + dr), (rr - dc, cc - dr)):
                    if (nr, nc) in grid: return -1
        return cross
    def put(w, r, c, d, clue):
        dr, dc = (0, 1) if d == 'a' else (1, 0)
        for k, ch in enumerate(w):
            rr, cc = r + dr * k, c + dc * k
            if (rr, cc) in grid: grid[(rr, cc)] = (ch, 'x')
            else: grid[(rr, cc)] = (ch, d)
        placed.append([w, clue, r, c, d])
    w0, cl0 = words[0]
    put(w0, size // 2 - 1, max(0, (size - len(w0)) // 2), 'a', cl0)
    for w, cl in words[1:]:
        best = None
        for (r0, c0), (ch, d0) in list(grid.items()):
            for k, x in enumerate(w):
                if x != ch: continue
                for d in ('a', 'd'):
                    if d0 == d: continue
                    r, c = (r0, c0 - k) if d == 'a' else (r0 - k, c0)
                    f = fits(w, r, c, d)
                    if f >= 1:
                        score = f + rng.random()
                        if not best or score > best[0]: best = (score, r, c, d)
        if best: put(w, best[1], best[2], best[3], cl)
    return placed, grid

def build_cross(rng):
    teams = [(t.upper(), f"{CITY[t]}’s NFL team") for t in CITY if t.isalpha() and len(t) <= 10]
    terms = [(w, c) for w, c in TERMS if len(w) <= 10]
    players = player_words()
    out, seen, uses = [], set(), defaultdict(int)
    tries = 0
    while len(out) < 140 and tries < 20000:
        tries += 1
        pick = rng.sample(teams, 2) + rng.sample(terms, 4) + [(w, c) for w, c, _ in rng.sample(players, 3)]
        if len(set(w for w, _ in pick)) < len(pick) or any(uses[w] >= 4 for w, _ in pick): continue
        pick.sort(key=lambda x: -len(x[0]))
        first, rest = pick[0], pick[1:]; rng.shuffle(rest)
        placed, grid = layout([first] + rest, rng)
        if len(placed) < 6: continue
        rows = [r for r, _ in grid]; cols = [c for _, c in grid]
        r0, c0 = min(rows), min(cols)
        h, w = max(rows) - r0 + 1, max(cols) - c0 + 1
        if w > 9 or h > 10: continue
        key = tuple(sorted(p[0] for p in placed))
        if key in seen: continue
        seen.add(key)
        for p in placed: uses[p[0]] += 1
        out.append({'w': w, 'h': h, 'words': [[p[0], p[1], p[2] - r0, p[3] - c0, p[4]] for p in placed]})
    return out

# ------------------------------------------------------------------------------------------------ Bonus: unscramble
COACHES = [('BELICHICK', 'Won six Super Bowls coaching the Patriots'), ('LOMBARDI', 'Packers coach; the Super Bowl trophy bears his name'),
    ('SHULA', 'Most wins by an NFL head coach; the 1972 Dolphins went 17-0'), ('LANDRY', 'Fedora-wearing Cowboys coach for 29 seasons'),
    ('WALSH', 'Built the 49ers’ West Coast offense'), ('NOLL', 'Won four Super Bowls with the 1970s Steelers'), ('GIBBS', 'Won three Super Bowls with Washington'),
    ('PARCELLS', 'The Big Tuna: two Super Bowls with the Giants'), ('DUNGY', 'Won Super Bowl XLI with the Colts'), ('DITKA', 'Coached the 1985 Bears to a title'),
    ('MADDEN', 'Raiders coach who later lent his name to a video game'), ('LEVY', 'Led the Bills to four straight Super Bowls'),
    ('REID', 'Chiefs coach with three Super Bowl wins in five years'), ('TOMLIN', 'Won Super Bowl XLIII with the Steelers'),
    ('HARBAUGH', 'Brothers who met in Super Bowl XLVII'), ('MCVAY', 'Won Super Bowl LVI with the Rams'), ('SHANAHAN', 'Father and son head coaches; Mike won two with Denver'),
    ('PAYTON', 'Won Super Bowl XLIV with the Saints'), ('CARROLL', 'Won Super Bowl XLVIII with the Seahawks'), ('COUGHLIN', 'Beat the 18-0 Patriots in Super Bowl XLII'),
    ('COWHER', 'Jaw-jutting coach of the Super Bowl XL Steelers'), ('VERMEIL', 'Won Super Bowl XXXIV with the Rams'), ('GRUDEN', 'Won Super Bowl XXXVII with the Bucs'),
    ('HOLMGREN', 'Won Super Bowl XXXI with the Packers'), ('HALAS', 'Papa Bear: founded and coached the Bears'), ('STRAM', 'Won Super Bowl IV with the Chiefs'),
    ('BILLICK', 'Won Super Bowl XXXV with the Ravens'), ('ARIANS', 'Won Super Bowl LV with the Buccaneers'), ('PEDERSON', 'Called the Philly Special in Super Bowl LII'),
    ('SIRIANNI', 'Eagles coach who won Super Bowl LIX'), ('MCCARTHY', 'Won Super Bowl XLV with the Packers'), ('GRANT', 'Took the Vikings to four Super Bowls'),
    ('SCHOTTENHEIMER', 'Won 200 regular-season games with four teams'), ('SEIFERT', 'Won two Super Bowls with the 49ers'), ('JOHNSON', 'Jimmy, who won two Super Bowls with Dallas'),
    ('CAMPBELL', 'Dan, the Lions coach known for going for it'), ('OCONNELL', 'Kevin, Vikings coach since 2022'), ('BROWN', 'Paul, the Browns’ founding coach'),
    ('ALLEN', 'George, Rams and Washington coach of the 1960s-70s')]
COACHES = [c for c in COACHES if len(c[0]) <= 10]

def build_scramble(rng):
    teams = [(t.upper(), f"Team: {CITY[t]}") for t in CITY if t.isalpha()]
    players = [(w, f"Player: {c}") for w, c, _ in player_words() if len(w) <= 9]
    seenp = set(); players = [x for x in players if not (x[0] in seenp or seenp.add(x[0]))]
    coaches = [(w, f"Coach: {c}") for w, c in COACHES]
    rng.shuffle(teams); rng.shuffle(players); rng.shuffle(coaches)
    def mix(w):
        for _ in range(50):
            l = list(w); rng.shuffle(l); s = ''.join(l)
            if s != w: return s
        return w[::-1]
    out = []
    pi = ti = ci = 0
    for d in range(DAYS):
        p1 = players[pi % len(players)]; p2 = players[(pi + 1) % len(players)]; pi += 2
        t = teams[ti % len(teams)]; ti += 1
        c = coaches[ci % len(coaches)]; ci += 1
        out.append([[w, cl, mix(w)] for w, cl in (p1, t, c, p2)])
    return out

# ------------------------------------------------------------------------------------------------ Bonus: score match
def build_scores(rng, espn_dir, used=frozenset()):
    games = []
    for f in sorted(os.listdir(espn_dir)):
        m = re.match(r'w(\d+)\.json$', f)
        if not m: continue
        d = json.load(open(os.path.join(espn_dir, f)))
        for e in d.get('events', []):
            if not e['status']['type']['completed']: continue
            c = e['competitions'][0]
            side = {x['homeAway']: x for x in c['competitors']}
            a, h = side['away'], side['home']
            sa, sh = int(a['score']), int(h['score'])
            if sa == sh: continue
            tm = lambda x: [x['team']['name'], x['team']['abbreviation'], x['team'].get('logo', '')]
            g = [int(m.group(1)), e['date'][:10]] + tm(a) + [sa] + tm(h) + [sh]
            if (g[0], g[3], g[7]) not in used: games.append(g)
    rng.shuffle(games)
    out = []
    for k in range(0, len(games) - 2, 3):
        trio = sorted(games[k:k + 3], key=lambda g: (g[0], g[1]))
        out.append(trio)
    return out

# ------------------------------------------------------------------------------------------------ classic sources
def build_classic():
    days = PZ['days']
    used = set(range(46))
    LINEUPS = [['col', 'stats', 'connections', 'numbers'], ['who', 'jr', 'grid', 'numbers'], ['col', 'who', 'stats', 'connections'],
               ['jr', 'grid', 'connections', 'numbers'], ['col', 'grid', 'stats', 'numbers'], ['who', 'jr', 'stats', 'connections'], ['col', 'who', 'grid', 'numbers']]
    FIELD = {'col': 'c', 'who': 'w', 'jr': 'j', 'grid': 'g'}
    used_src = defaultdict(set)
    for seed in range(13):  # days 47-59
        for t in LINEUPS[seed % 7]:
            if t in FIELD:
                cand = [i for i, d in enumerate(days) if d.get('v') == 4 and t in d.get('t', []) and d.get(FIELD[t]) is not None]
                used_src[t].add(cand[seed % len(cand)])
    seen_who = {days[i]['w'] for i in list(used) + list(used_src['who']) if days[i].get('w') is not None}
    seen_jr = {days[i]['j']['p'] for i in list(used) + list(used_src['jr']) if days[i].get('j')}
    seen_col = {json.dumps(days[i]['c']) for i in list(used) + list(used_src['col']) if days[i].get('c')}
    seen_grid = {json.dumps(days[i]['g']) for i in list(used) + list(used_src['grid']) if days[i].get('g')}
    out = {}
    for t, f in FIELD.items():
        lst, seen = [], set()
        for i, d in enumerate(days):
            if i in used or i in used_src[t] or d.get('v') != 4 or t not in d.get('t', []) or d.get(f) is None: continue
            key = d['w'] if t == 'who' else d['j']['p'] if t == 'jr' else json.dumps(d[f])
            prior = seen_who if t == 'who' else seen_jr if t == 'jr' else seen_col if t == 'col' else seen_grid
            if key in prior or key in seen: continue
            seen.add(key); lst.append(i)
        out[t] = lst
    return out

def main():
    espn = sys.argv[1] if len(sys.argv) > 1 else None
    bank = {'v': 1, 'from': '2026-11-26',
            'hl': build_hl(random.Random(601)), 'conn': build_conn(random.Random(602)), 'num': build_num(random.Random(603)),
            'bonus': {'wheel': build_wheel(random.Random(604)), 'cross': build_cross(random.Random(605)),
                      'scramble': build_scramble(random.Random(606)), 'score': build_scores(random.Random(607), espn) if espn else []},
            'classic': build_classic()}
    path = os.path.join(ROOT, 'data/trivia-v6.json')
    # Append-only: a level once in the file keeps its place (days already played never change); a rerun (say with
    # more weeks of scores) only adds the new levels after them.
    if os.path.exists(path):
        old = json.load(open(path))
        def merge(a, b):
            seen = {json.dumps(x, sort_keys=True) for x in a}
            return a + [x for x in b if json.dumps(x, sort_keys=True) not in seen]
        for k in ('hl', 'conn', 'num'): bank[k] = merge(old.get(k, []), bank[k])
        for k in bank['bonus']: bank['bonus'][k] = merge(old.get('bonus', {}).get(k, []), bank['bonus'][k])
        for k in bank['classic']: bank['classic'][k] = merge(old.get('classic', {}).get(k, []), bank['classic'][k])
        if old.get('bonus', {}).get('score') and espn:  # only games not in a score set yet make new sets
            used = {(g[0], g[3], g[7]) for st in old['bonus']['score'] for g in st}
            bank['bonus']['score'] = old['bonus']['score'] + build_scores(random.Random(607 + len(used)), espn, used)
    json.dump(bank, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
    print(path, os.path.getsize(path), 'bytes')
    print({k: len(v) for k, v in bank.items() if isinstance(v, list)}, {k: len(v) for k, v in bank['bonus'].items()}, {k: len(v) for k, v in bank['classic'].items()})

if __name__ == '__main__':
    main()
