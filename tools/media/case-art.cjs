// The Media Room's game case art (Nov 24 2026, Evan: "Create a new disc on the Home Screen for the media room ... Make
// this look like a Netflix or HBO app"): the cover, the booklet in its lid and the disc, drawn in a real browser from
// the videos' own poster frames (video/press/*.jpg, video/media/*.jpg) and the app's Barlow Condensed, then saved as
// WebP (python3 + Pillow) under img/games/media-{cover,book,disc}-v1.webp. A changed design gets a new version number
// (and its paths in views/games.js and sw.js).
// Usage: node tools/media/case-art.cjs [cover] [book] [disc] (default all)
const fs = require('node:fs'), path = require('node:path'), {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..'), OUT = path.join(root, 'img/games');
// The cover is 808 x 1040, what the case shows of it (puzzles.css .gm-img is top-anchored; up close .gm-art is 808 / 1040).
// Each piece's version (the cover v2, Nov 25 2026, Evan: "Remove the now streaming and bottom text from the media room case").
const V = {cover: 'v2', book: 'v1', disc: 'v1'};
const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'media-art-'));
const uri = f => 'data:image/' + (f.endsWith('.jpg') ? 'jpeg' : 'webp') + ';base64,' + fs.readFileSync(path.join(root, f)).toString('base64');
const font = 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'fonts/barlow-condensed-800.woff2')).toString('base64');
const posters = [...fs.readdirSync(path.join(root, 'video/press')).filter(f => f.endsWith('.jpg')).map(f => 'video/press/' + f),
  ...fs.readdirSync(path.join(root, 'video/media')).filter(f => f.endsWith('.jpg')).map(f => 'video/media/' + f)].sort();
// a fixed shuffle, so the wall mixes the pressers and the Happy Meals
const wall = posters.map((f, i) => ({f, k: (i * 7919) % 101})).sort((a, b) => a.k - b.k).map(x => uri(x.f));
const RED = '#e3342f';
const base = `@font-face{font-family:BC;src:url(${font}) format('woff2');font-weight:800}
*{box-sizing:border-box;margin:0;padding:0}html,body{background:transparent}
.bc{font-family:BC,'Arial Narrow',sans-serif;font-weight:800;text-transform:uppercase}
.t{font-family:Inter,'Helvetica Neue',Arial,sans-serif}`;
const tiles = (n, off = 0) => Array.from({length: n}, (_, i) => `<i style="background-image:url(${wall[(i + off) % wall.length]})"></i>`).join('');
const wallCSS = (cols, w, h, gap) => `.wall{position:absolute;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:${gap}px}
.wall i{display:block;width:${w}px;height:${h}px;border-radius:10px;background:#222 center 30%/cover;box-shadow:0 10px 30px #000a}`;
const mark = (size, one = false) => `<div class="bc mk" style="font-size:${size}px;line-height:.82;letter-spacing:-.01em;color:#fff;text-align:center">
  <span style="display:block;font-size:.26em;letter-spacing:.32em;color:#e9e9e9;margin-bottom:.12em">GRIDIRON HUB</span>
  <span style="display:${one ? 'inline' : 'block'};color:${RED};text-shadow:0 .03em 0 #7d0f0b,0 .06em .2em #000">MEDIA</span>${one ? ' ' : ''}<span style="display:${one ? 'inline' : 'block'};text-shadow:0 .06em .2em #000">ROOM</span></div>`;

const COVER = {w: 808, h: 1040, html: `<style>${base}${wallCSS(4, 230, 340, 18)}
body{width:808px;height:1040px;position:relative;overflow:hidden;background:#050506}
.wall{left:-170px;top:-120px;transform:perspective(1400px) rotateX(18deg) rotateZ(-11deg);transform-origin:50% 0}
.fade{position:absolute;inset:0;background:linear-gradient(180deg,#0506 0%,#05050600 22%,#050506aa 48%,#050506 66%),radial-gradient(120% 70% at 50% 100%,#3a0a08aa,#0000 60%)}
.mk{position:absolute;left:0;right:0;top:545px}
.tag{position:absolute;left:0;right:0;top:1028px;text-align:center;color:#d9d9d9;font-size:25px;letter-spacing:.2em}
.tag b{color:${RED}}
.bar{position:absolute;left:44px;right:44px;bottom:40px;display:flex;justify-content:space-between;align-items:center;color:#bbb;font-size:22px;letter-spacing:.14em}
.rt{border:3px solid #ddd;color:#fff;padding:6px 10px 3px;font-size:24px;letter-spacing:.06em}
.new{position:absolute;top:36px;left:36px;background:${RED};color:#fff;font-size:26px;letter-spacing:.14em;padding:8px 16px 5px;border-radius:4px;box-shadow:0 6px 20px #000c}
.play{position:absolute;left:50%;top:418px;width:96px;height:96px;margin-left:-48px;border-radius:50%;background:#ffffffe6;box-shadow:0 10px 40px #000}
.play:after{content:'';position:absolute;left:38px;top:28px;border-left:32px solid #111;border-top:20px solid transparent;border-bottom:20px solid transparent}
</style><div class="wall">${tiles(20)}</div><div class="fade"></div><span class="play"></span>
${mark(232)}`};

const BOOK = {w: 620, h: 930, html: `<style>${base}
body{width:620px;height:930px;position:relative;overflow:hidden;background:#0c0c0e;color:#fff;padding:44px 40px}
h1{font-size:30px;letter-spacing:.24em;color:${RED}}h2{font-size:92px;line-height:.86;margin:10px 0 24px}
.row{display:grid;grid-template-columns:118px 1fr;gap:16px;align-items:center;margin:0 0 16px}
.row i{display:block;height:70px;border-radius:6px;background:#222 center 30%/cover}
.row b{display:block;font-size:30px;letter-spacing:.02em}.row small{display:block;font-size:17px;color:#9a9a9a;margin-top:3px}
.ft{position:absolute;left:40px;right:40px;bottom:34px;display:flex;justify-content:space-between;color:#777;font-size:20px;letter-spacing:.18em;border-top:2px solid #2a2a2a;padding-top:14px}
</style><h1 class="bc">TONIGHT'S LINEUP</h1><h2 class="bc">ON THE<br>MEDIA ROOM</h2>
${[['PRESS CONFERENCES', 'The Matchup of the Week loser faces the media'], ['THE HAPPY MEAL CHALLENGE', 'The race that set the 2026 draft order'],
  ['CONTINUE WATCHING', 'Pick up right where you left off'], ['FROM THE PRESS', "The league chat's questions, on every episode"],
  ['THE DRAFT ORDER', 'Every time, every penalty, pick by pick'], ['NEW EVERY WEEK', 'A new episode after every Matchup of the Week']]
  .map(([b, s], i) => `<div class="row"><i style="background-image:url(${wall[(i * 3) % wall.length]})"></i><span><b class="bc">${b}</b><small class="t">${s}</small></span></div>`).join('')}
<div class="bc ft"><span>GRIDIRON HUB</span><span>MEDIA ROOM</span></div>`};

const DISC = {w: 706, h: 706, transparent: true, html: `<style>${base}${wallCSS(5, 150, 220, 10)}
body{width:706px;height:706px;position:relative}
.d{position:absolute;inset:3px;border-radius:50%;overflow:hidden;background:#060607;box-shadow:inset 0 0 0 3px #3a3a3e}
.wall{left:-120px;top:-60px;transform:rotateZ(-14deg)}
.sh{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#060607 0 20%,#060607cc 28%,#06060755 46%,#06060700 60%),linear-gradient(180deg,#0000 30%,#060607ee 74%)}
.foil{position:absolute;inset:0;background:conic-gradient(from 20deg,#fff0,#ffffff1c,#fff0 18%,#ffffff12 30%,#fff0 45%,#ffffff1a 62%,#fff0 80%);mix-blend-mode:screen}
.mk{position:absolute;left:0;right:0;top:452px}
.hole{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px;border-radius:50%;background:radial-gradient(circle,#0000 0 30px,#cfd3d8 31px 33px,#e9ecef 34px 52px,#9aa0a6 53px 54px,#1a1a1c 55px 75px)}
.rt{position:absolute;left:50%;top:590px;transform:translateX(-50%);color:#aaa;font-size:20px;letter-spacing:.2em}
</style><div class="d"><div class="wall">${tiles(25, 5)}</div><div class="sh"></div><div class="foil"></div>${mark(104, true)}<span class="bc rt">TV-GG · HD</span></div><div class="hole"></div>`};

(async () => {
  const {chromium} = require('playwright');
  const b = await chromium.launch();
  try {
    const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
    for (const [name, A] of Object.entries({cover: COVER, book: BOOK, disc: DISC}).filter(([n]) => !want.length || want.includes(n))) {
      const p = await b.newPage({viewport: {width: A.w, height: A.h}, deviceScaleFactor: 1});
      await p.setContent(`<!doctype html><meta charset="utf-8">${A.html}`);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(200);
      const png = path.join(tmp, name + '.png');
      await p.screenshot({path: png, omitBackground: !!A.transparent});
      // the disc's middle is see-through, as every disc's is
      const out = path.join(OUT, `media-${name}-${V[name]}.webp`);
      execFileSync('python3', ['-I', '-c', `import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('RGBA')
if sys.argv[3] == '1':
    m = Image.new('L', im.size, 0); d = ImageDraw.Draw(m); w, h = im.size
    d.ellipse((3, 3, w - 3, h - 3), fill=255); r = 30; d.ellipse((w/2 - r, h/2 - r, w/2 + r, h/2 + r), fill=0)
    im.putalpha(Image.composite(im.getchannel('A'), Image.new('L', im.size, 0), m))
    im.save(sys.argv[2], 'WEBP', quality=86, method=6)
else:
    im.convert('RGB').save(sys.argv[2], 'WEBP', quality=84, method=6)`, png, out, A.transparent ? '1' : '0']);
      console.log('wrote', path.relative(root, out), fs.statSync(out).size, 'bytes');
      await p.close();
    }
  } finally { await b.close(); fs.rmSync(tmp, {recursive: true, force: true}); }
})().catch(e => { console.error(e); process.exit(1); });
