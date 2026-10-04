#!/usr/bin/env python3
"""Generates css/themes.css and js/themes.js (the theme list) from the palettes below.
Run: python3 tools/themes.py   (then bump CACHE in sw.js)

Each theme sets the colour tokens of css/tokens.css (plus a few theme hooks: --sky, --stars, --title-bg, --bevel,
--hard-shadow, fonts) on :root[data-skin="<id>"]. Retro, the default, sets nothing: tokens.css is retro.
NFL themes are derived from a team's colours: the background from `hue`, the accent (--tint) from `tint`."""
import colorsys, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
def hexc(c): return '#' + ''.join('%02X' % round(max(0, min(1, x)) * 255) for x in c)
def hls(h, l, s): return hexc(colorsys.hls_to_rgb(h, l, s))
def rgba(h, a): r, g, b = rgb(h); return 'rgba(%d,%d,%d,%s)' % (round(r * 255), round(g * 255), round(b * 255), a)
def lum(h):
    def ch(c): return c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    r, g, b = (ch(x) for x in rgb(h)); return .2126 * r + .7152 * g + .0722 * b
def shade(h, k):  # k < 0 darker, > 0 lighter (HLS lightness)
    H, L, S = colorsys.rgb_to_hls(*rgb(h)); return hls(H, max(0, min(1, L + k)), S)

# ------------------------------------------------------------------ NFL: (abbr, name, hue source, accent, gold)
NFL = [
    ('ari', 'Arizona Cardinals', '#97233F', '#FF4D6D', '#FFB612'), ('atl', 'Atlanta Falcons', '#A71930', '#FF4B5C', '#C9CED1'),
    ('bal', 'Baltimore Ravens', '#241773', '#9E86FF', '#D4AF37'), ('buf', 'Buffalo Bills', '#00338D', '#4D8DFF', None),
    ('car', 'Carolina Panthers', '#0085CA', '#33B5F5', None), ('chi', 'Chicago Bears', '#0B162A', '#FF6A1A', None),
    ('cin', 'Cincinnati Bengals', '#FB4F14', '#FF6A2B', None), ('cle', 'Cleveland Browns', '#311D00', '#FF5A1F', None),
    ('dal', 'Dallas Cowboys', '#003594', '#5B8FFF', '#C4CED4'), ('den', 'Denver Broncos', '#002244', '#FF6A2B', None),
    ('det', 'Detroit Lions', '#0076B6', '#3DB4FF', '#C4CBD0'), ('gb', 'Green Bay Packers', '#203731', '#FFB612', '#FFB612'),
    ('hou', 'Houston Texans', '#03202F', '#E8304A', None), ('ind', 'Indianapolis Colts', '#002C5F', '#3F8CFF', None),
    ('jax', 'Jacksonville Jaguars', '#006778', '#1FC2D6', '#D7A22A'), ('kc', 'Kansas City Chiefs', '#E31837', '#FF3B55', '#FFB81C'),
    ('lv', 'Las Vegas Raiders', '#000000', '#C4C9CC', None), ('lac', 'Los Angeles Chargers', '#0080C6', '#3DB2FF', '#FFC20E'),
    ('lar', 'Los Angeles Rams', '#003594', '#FFB41F', '#FFB41F'), ('mia', 'Miami Dolphins', '#008E97', '#1FD1DB', '#FC7A32'),
    ('min', 'Minnesota Vikings', '#4F2683', '#A979FF', '#FFC62F'), ('ne', 'New England Patriots', '#002244', '#FF3D57', None),
    ('no', 'New Orleans Saints', '#101820', '#D3BC8D', '#D3BC8D'), ('nyg', 'New York Giants', '#0B2265', '#4D74FF', None),
    ('nyj', 'New York Jets', '#125740', '#2FD08A', None), ('phi', 'Philadelphia Eagles', '#004C54', '#2FC4B2', '#C4CBD0'),
    ('pit', 'Pittsburgh Steelers', '#101820', '#FFB612', '#FFB612'), ('sf', 'San Francisco 49ers', '#AA0000', '#FF3B3B', '#D9BA6E'),
    ('sea', 'Seattle Seahawks', '#002244', '#69BE28', None), ('tb', 'Tampa Bay Buccaneers', '#D50A0A', '#FF7900', None),
    ('ten', 'Tennessee Titans', '#0C2340', '#4B92DB', None), ('wsh', 'Washington Commanders', '#5A1414', '#FFB612', '#FFB612'),
]

def team(hue, tint, gold):
    H, L, S = colorsys.rgb_to_hls(*rgb(hue))
    s = min(S, .7) if S > .08 else 0  # black teams stay neutral
    on = '#0A0A0A' if lum(tint) > .3 else '#FFFFFF'
    g = gold or '#FFC531'
    return {
        'bg': hls(H, .075, s), 'surface-1': hls(H, .125, s * .9), 'surface-2': hls(H, .17, s * .8), 'surface-3': hls(H, .23, s * .7),
        'fill': rgba(hls(H, .55, s * .5), .2), 'separator': hls(H, .18, s * .7), 'bar': rgba(hls(H, .05, s), .86), 'bar-solid': hls(H, .07, s),
        'ink': '#FFFFFF', 'ink-2': hls(H, .8, s * .3), 'ink-3': hls(H, .62, s * .25), 'ink-4': hls(H, .45, s * .25),
        'tint': tint, 'tint-pressed': shade(tint, -.08), 'on-tint': on, 'tint-soft': rgba(tint, .16),
        'gold': g, 'gold-soft': rgba(g, .16), 'thumb': hls(H, .45, s * .25), 'switch-off': hls(H, .2, s * .6), 'grabber': hls(H, .35, s * .4),
        'sky': hls(H, .26, s), 'title-bg': f"radial-gradient(120% 70% at 50% 0%, {hls(H, .3, s)} 0%, {hls(H, .13, s)} 40%, {hls(H, .05, s)} 75%) {hls(H, .05, s)}",
        'bevel': shade(tint, -.22), 'font': 'modern'}

# ------------------------------------------------------------------ Creative themes (hand-made)
DARK_DEF = {'ink': '#FFFFFF', 'wrong': '#FF5A4A', 'wrong-soft': 'rgba(255,90,74,.16)'}
CREATIVE = [
    ('space', 'Outer Space', 'Deep-space violet, nebula glow, a sky full of stars', dict(DARK_DEF, **{
        'bg': '#05030F', 'surface-1': '#110B26', 'surface-2': '#1B1340', 'surface-3': '#291E5A', 'fill': 'rgba(150,130,255,.18)', 'separator': '#271C52',
        'bar': 'rgba(6,4,18,.86)', 'bar-solid': '#0A0619', 'ink-2': '#CCC3F0', 'ink-3': '#968CC2', 'ink-4': '#665D92',
        'tint': '#5CE1FF', 'tint-pressed': '#3CCBEB', 'on-tint': '#021B26', 'tint-soft': 'rgba(92,225,255,.16)', 'gold': '#FFD36B', 'gold-soft': 'rgba(255,211,107,.16)',
        'link': '#B69CFF', 'thumb': '#665D92', 'switch-off': '#2A2058', 'grabber': '#4B4180',
        'sky': '#2B1263', 'title-bg': 'radial-gradient(90% 60% at 70% 10%, #4A1E9C 0%, #1A0B45 40%, #05030F 75%) #05030F', 'bevel': '#1F8FB0',
        'stars': 'more', 'font': 'modern'})),
    ('future', 'Futuristic', 'Carbon black, electric cyan, hard edges and a HUD glow', dict(DARK_DEF, **{
        'bg': '#030709', 'surface-1': '#0A1318', 'surface-2': '#0F1D25', 'surface-3': '#162B37', 'fill': 'rgba(0,240,255,.12)', 'separator': '#16303C',
        'bar': 'rgba(3,7,9,.88)', 'bar-solid': '#060C10', 'ink': '#E8FBFF', 'ink-2': '#A3C6D2', 'ink-3': '#6F95A3', 'ink-4': '#4A6875',
        'tint': '#00F0FF', 'tint-pressed': '#00CFDC', 'on-tint': '#00191C', 'tint-soft': 'rgba(0,240,255,.14)', 'gold': '#FFE14D', 'gold-soft': 'rgba(255,225,77,.16)',
        'link': '#00F0FF', 'thumb': '#4A6875', 'switch-off': '#163040', 'grabber': '#2E4A58',
        'sky': '#00303A', 'title-bg': 'linear-gradient(180deg, #002A33 0%, #030709 60%) #030709', 'bevel': '#007C85',
        'stars': 'grid', 'font': 'future', 'radius': 'sharp', 'hard-shadow': '0 0 10px rgba(0,240,255,.55)'})),
    ('tundra', 'Frozen Tundra', 'Icy blues and whites: Lambeau in January', dict(DARK_DEF, **{
        'bg': '#08182A', 'surface-1': '#10263C', 'surface-2': '#18334F', 'surface-3': '#224466', 'fill': 'rgba(170,220,255,.16)', 'separator': '#1F3B58',
        'bar': 'rgba(8,24,42,.84)', 'bar-solid': '#0B1D31', 'ink': '#F4FBFF', 'ink-2': '#C3DCEE', 'ink-3': '#8FB0C8', 'ink-4': '#5E7F98',
        'tint': '#8FE3FF', 'tint-pressed': '#6FD3F5', 'on-tint': '#032033', 'tint-soft': 'rgba(143,227,255,.16)', 'gold': '#FFD86B', 'gold-soft': 'rgba(255,216,107,.16)',
        'link': '#BDEBFF', 'thumb': '#5E7F98', 'switch-off': '#21405E', 'grabber': '#46688A',
        'sky': '#2B5A80', 'title-bg': 'radial-gradient(120% 70% at 50% 0%, #4F8DBA 0%, #1C4268 40%, #08182A 75%) #08182A', 'bevel': '#4FA9CC',
        'stars': 'snow', 'font': 'modern'})),
    ('neon', 'Neon Nights', '80s synthwave: hot pink and cyan neon on deep purple', dict(DARK_DEF, **{
        'bg': '#12041F', 'surface-1': '#1F0A33', 'surface-2': '#2B1046', 'surface-3': '#3B165E', 'fill': 'rgba(255,60,172,.14)', 'separator': '#3A1A55',
        'bar': 'rgba(18,4,31,.86)', 'bar-solid': '#170628', 'ink-2': '#E6C6F7', 'ink-3': '#AE8AC6', 'ink-4': '#7A5A94',
        'tint': '#FF3CAC', 'tint-pressed': '#E62A96', 'on-tint': '#FFFFFF', 'tint-soft': 'rgba(255,60,172,.16)', 'gold': '#FFD319', 'gold-soft': 'rgba(255,211,25,.16)',
        'link': '#2DE2E6', 'thumb': '#7A5A94', 'switch-off': '#3A1858', 'grabber': '#5E3A7E',
        'sky': '#5A0F6E', 'title-bg': 'linear-gradient(180deg, #2B0A4A 0%, #6E1470 45%, #FF3CAC 62%, #12041F 63%) #12041F', 'bevel': '#A0156A',
        'stars': 'on', 'font': 'modern', 'hard-shadow': '0 0 8px rgba(255,60,172,.75)'})),
    ('oldschool', 'Old School Gridiron', 'A 1950s game program: cream paper, leather brown, serif type', {
        'scheme': 'light', 'bg': '#EDE1C6', 'surface-1': '#F8F0DC', 'surface-2': '#E8D9B8', 'surface-3': '#D9C59D', 'fill': 'rgba(90,60,20,.12)', 'separator': '#CFB98F',
        'bar': 'rgba(237,225,198,.88)', 'bar-solid': '#EDE1C6', 'ink': '#2B1B0E', 'ink-2': '#5B4630', 'ink-3': '#7D6648', 'ink-4': '#A08A69',
        'tint': '#8C2F1B', 'tint-pressed': '#73240F', 'on-tint': '#FFF5E1', 'tint-soft': 'rgba(140,47,27,.12)', 'gold': '#A87406', 'gold-soft': 'rgba(168,116,6,.14)',
        'wrong': '#B3261E', 'wrong-soft': 'rgba(179,38,30,.12)', 'link': '#1F4E79', 'thumb': '#A08A69', 'switch-off': '#CDB993', 'grabber': '#B8A27C',
        'sky': 'transparent', 'title-bg': 'radial-gradient(110% 70% at 50% 20%, #F8F0DC 0%, #E6D3AC 60%, #CDB385 100%) #E6D3AC', 'bevel': '#5A1C0E',
        'stars': 'none', 'font': 'serif', 'hard-shadow': 'none', 'pixel-shadow': '0 2px 0 rgba(60,40,10,.18)'}),
    ('day', 'Daytime', 'Bright and clean for game-day afternoons: tailgate orange on white', {
        'scheme': 'light', 'bg': '#EFF3F9', 'surface-1': '#FFFFFF', 'surface-2': '#EEF2F8', 'surface-3': '#DDE4EF', 'fill': 'rgba(30,60,120,.08)', 'separator': '#DCE2EC',
        'bar': 'rgba(245,248,252,.86)', 'bar-solid': '#F5F8FC', 'ink': '#0B1530', 'ink-2': '#3D4A66', 'ink-3': '#66718D', 'ink-4': '#97A1B6',
        'tint': '#F06A00', 'tint-pressed': '#D45D00', 'on-tint': '#FFFFFF', 'tint-soft': 'rgba(240,106,0,.12)', 'gold': '#D99A00', 'gold-soft': 'rgba(217,154,0,.14)',
        'wrong': '#D93025', 'wrong-soft': 'rgba(217,48,37,.1)', 'link': '#1A73E8', 'thumb': '#97A1B6', 'switch-off': '#D3DAE6', 'grabber': '#C3CBD8',
        'sky': 'transparent', 'title-bg': 'linear-gradient(180deg, #7CC4FF 0%, #CDE8FF 55%, #EFF3F9 100%) #EFF3F9', 'bevel': '#B04E00',
        'stars': 'none', 'font': 'modern', 'hard-shadow': 'none', 'pixel-shadow': '0 2px 8px rgba(20,40,80,.08)'}),
]

TOKENS = ['bg', 'surface-1', 'surface-2', 'surface-3', 'fill', 'separator', 'bar', 'bar-solid', 'ink', 'ink-2', 'ink-3', 'ink-4', 'tint', 'tint-pressed',
          'on-tint', 'tint-soft', 'wrong', 'wrong-soft', 'gold', 'gold-soft', 'link', 'thumb', 'switch-off', 'grabber', 'sky', 'title-bg', 'bevel',
          'hard-shadow', 'pixel-shadow']
FONTS = {
    'modern': '--font-pixel: "Barlow Condensed", "Arial Narrow", sans-serif; --font-num: "Barlow Condensed", "Arial Narrow", sans-serif;',
    'future': '--font-pixel: "Barlow Condensed", "Arial Narrow", sans-serif; --font-num: "Barlow Condensed", "Arial Narrow", sans-serif;',
    'serif': '--font-pixel: Georgia, "Times New Roman", serif; --font-num: Georgia, "Times New Roman", serif;',
}

def block(tid, t):
    light = t.get('scheme') == 'light'
    out = [f':root[data-skin="{tid}"] {{', f'  color-scheme: {"light" if light else "dark"};']
    line = []
    for k in TOKENS:
        if k in t: line.append(f'--{k}: {t[k]};')
    for i in range(0, len(line), 4): out.append('  ' + ' '.join(line[i:i + 4]))
    out.append('  ' + FONTS[t.get('font', 'modern')])
    out.append('}')
    return '\n'.join(out)

themes = [{'id': 'retro', 'name': 'Retro Arcade', 'group': 'Classic', 'note': 'The original: 8-bit night stadium', 'bg': '#070E22', 'sw': ['#070E22', '#1A2850', '#7CF058', '#FFC531']}]
css = []
for tid, name, note, t in CREATIVE:
    css.append(block(tid, t))
    themes.append({'id': tid, 'name': name, 'group': 'Creative', 'note': note, 'bg': t['bg'], 'light': t.get('scheme') == 'light',
                   'sw': [t['bg'], t['surface-2'], t['tint'], t['gold']], 'font': t.get('font'), 'stars': t.get('stars'), 'radius': t.get('radius')})
for abbr, name, hue, tint, gold in NFL:
    t = team(hue, tint, gold)
    css.append(block(abbr, t))
    themes.append({'id': abbr, 'name': name, 'group': 'NFL', 'bg': t['bg'], 'sw': [t['bg'], t['surface-2'], t['tint'], t['gold']]})

head = """/* themes.css: GENERATED by tools/themes.py (edit the palettes there). The app's themes as token sets on
   :root[data-skin="<id>"] (set by js/themes.js before first paint). Retro, the default, has no block: tokens.css is
   retro. Shared looks for the non-retro families follow the generated blocks. */
"""
shared = open(os.path.join(ROOT, 'tools', 'themes-shared.css')).read()
open(os.path.join(ROOT, 'css', 'themes.css'), 'w').write(head + '\n\n'.join(css) + '\n\n' + shared)

js_list = json.dumps([{k: v for k, v in x.items() if v is not None} for x in themes], separators=(',', ':'))
tpl = open(os.path.join(ROOT, 'tools', 'themes-template.js')).read()
open(os.path.join(ROOT, 'js', 'themes.js'), 'w').write(tpl.replace('/*THEMES*/[]', js_list))
print(len(themes), 'themes')
