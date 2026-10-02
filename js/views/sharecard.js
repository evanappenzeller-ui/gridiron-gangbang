// PNG share card (spec 7.7), 1080×1350, drawn on a canvas. renderShareCard(opts) → Promise<Blob>.
// Colors come from the design tokens at runtime; the league name, day, marks, streak and rank from live data.
// Rows follow the day's steps (daily.stepsFor: three on v1 and v4 days, five on v2 and v3), in the day's order.
// Owner: PUZZLES (tabs-v4; was the daily-hub package).
import * as daily from '../core/daily.js';
import * as data from '../core/data.js';

const W = 1080, H = 1350, PAD = 96;

function tok(name, fb) {
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (_) { return fb; }
}
function palette() {
  return {
    bg: tok('--bg', '#000000'), ink: tok('--ink', '#FFFFFF'), ink2: tok('--ink-2', '#AEAEB2'), ink3: tok('--ink-3', '#8E8E93'),
    ink4: tok('--ink-4', '#636366'), s2: tok('--surface-2', '#2C2C2E'), s3: tok('--surface-3', '#3A3A3C'),
    tint: tok('--tint', '#7CF058'), wrong: tok('--wrong', '#FF453A'), gold: tok('--gold', '#FFCC4D'),
    f1: tok('--flame-1', '#FFD24A'), f2: tok('--flame-2', '#FF7A2F')
  };
}
const NUM = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';
const TXT = () => tok('--font-text', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif');

function rr(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function spacing(c, px) { if ('letterSpacing' in c) c.letterSpacing = px + 'px'; }
// Shrinks the font until the text fits maxW.
function fitFont(c, text, weight, size, family, maxW) {
  let s = size;
  c.font = `${weight} ${s}px ${family}`;
  while (s > 12 && c.measureText(text).width > maxW) { s -= 2; c.font = `${weight} ${s}px ${family}`; }
  return s;
}
function flamePath() {
  try {
    const p = document.querySelector('#i-flame path');
    if (p && p.getAttribute('d')) return new Path2D(p.getAttribute('d'));
  } catch (_) {}
  return null;
}

/**
 * opts (all optional): ds, day, pnum (default: the live day), rank (your Today rank, shown when known),
 * streak (default: streakLocal().current).
 */
export async function renderShareCard(o = {}) {
  if (daily.status !== 'ready' || !daily.DAY) throw new Error('The Daily is not loaded');
  const ds = o.ds || daily.DS, day = o.day || daily.DAY, pnum = o.pnum || daily.PNUM;
  const ver = daily.dayVersion(day);
  const ids = daily.stepsFor(day).map(s => s.id); // the rows, in the day's order
  const five = ids.length > 3, short = ver >= 3; // short (v3, v4): one or two items per puzzle, one-line rows
  const max = daily.maxPts(day);
  const total = daily.totalPts(ds, day);
  const grade = daily.gradeFor(total, max);
  const perfect = total >= max;
  const streak = o.streak != null ? o.streak : daily.streakLocal().current;
  const rank = o.rank;
  try {
    await Promise.race([document.fonts.load('800 100px "Barlow Condensed"'), new Promise(r => setTimeout(r, 1500))]);
  } catch (_) {}

  const C = palette();
  const txt = TXT();
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = C.bg;
  c.fillRect(0, 0, W, H);

  // Six faint tint bands, like yard lines.
  c.save();
  c.globalAlpha = .03;
  c.fillStyle = C.tint;
  for (let k = 0; k < 6; k++) c.fillRect(0, 40 + k * 225, W, 112);
  c.restore();

  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';

  // Overline + date (the puzzle day's date replaces the old "Daily #n")
  const league = (data.DATA && data.DATA.league && data.DATA.league.name) || 'Gridiron Gangbang';
  const ovl = `${league} · Daily`.toUpperCase();
  spacing(c, 4);
  c.fillStyle = C.ink3;
  fitFont(c, ovl, 800, 44, NUM, W - PAD * 2);
  c.fillText(ovl, W / 2, 150);
  spacing(c, 0);
  let dateStr = '';
  try { dateStr = daily.dateOf(pnum).toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'}); } catch (_) {}
  c.fillStyle = C.ink2;
  c.font = `400 34px ${txt}`;
  c.fillText(dateStr, W / 2, 204);

  // Layout: v1 (three rows) keeps the original positions; v2 (five rows, a 3 x 3 grid) tightens the hero and the rows;
  // v3 (five rows, every row one line: two squares, pips, or 1 x 2 grid squares) spaces the rows evenly; v4 (three
  // one-line rows) keeps the v1 hero and spaces its rows evenly.
  const G = five
    ? (short
      ? {tot: 240, totY: 440, ofY: 496, grY: 574, grS: 54, rule: 622, rows: [654, 752, 850, 948, 1046], sq: 72, sqGap: 14, pip: 56, cell: 72, cellGap: 14}
      : {tot: 220, totY: 420, ofY: 474, grY: 548, grS: 52, rule: 592, rows: [616, 708, 800, 892, 984], sq: 64, sqGap: 12, pip: 50, cell: 46, cellGap: 8})
    : short
      ? {tot: 260, totY: 468, ofY: 526, grY: 612, grS: 56, rule: 668, rows: [720, 864, 1008], sq: 72, sqGap: 14, pip: 56, cell: 72, cellGap: 14}
      : {tot: 260, totY: 468, ofY: 526, grY: 612, grS: 56, rule: 668, rows: [706, 826, 928], sq: 72, sqGap: 14, pip: 56, cell: 56, cellGap: 10};

  // Total, "of 1,000", grade
  c.fillStyle = C.ink;
  c.font = `800 ${G.tot}px ${NUM}`;
  c.fillText(data.nf(total), W / 2, G.totY);
  c.fillStyle = C.ink3;
  c.font = `800 40px ${NUM}`;
  spacing(c, 2);
  c.fillText(`OF ${data.nf(max)}`, W / 2, G.ofY);
  spacing(c, 6);
  c.fillStyle = grade === 'ALL-PRO' || grade === 'PERFECT DAY' ? C.gold : C.ink2;
  c.font = `800 ${G.grS}px ${NUM}`;
  c.fillText(grade, W / 2, G.grY);
  spacing(c, 0);

  // Rows: label + points on the left, marks on the right.
  const L = PAD + 24, R = W - PAD - 24;
  const label = (t, pts, y) => {
    c.textAlign = 'left';
    spacing(c, 3);
    c.fillStyle = C.ink2;
    c.font = `800 36px ${NUM}`;
    c.fillText(t, L, y);
    spacing(c, 1);
    c.fillStyle = C.ink3;
    c.font = `800 30px ${NUM}`;
    c.fillText(`${data.nf(pts)} PTS`, L, y + 38);
    spacing(c, 0);
  };
  const word = (t, y, color) => {
    c.textAlign = 'right';
    spacing(c, 4);
    c.fillStyle = color;
    c.font = `800 56px ${NUM}`;
    c.fillText(t, R, y + 56);
    spacing(c, 0);
  };
  // One rounded square per item (College, Faces: five, or two on a v3 or v4 day), right-aligned: tint right, red wrong,
  // grey unanswered.
  const squares = (marks, y) => {
    const n = marks.length;
    for (let i = 0; i < n; i++) {
      const x = R - (n - i) * G.sq - (n - 1 - i) * G.sqGap;
      rr(c, x, y, G.sq, G.sq, 16);
      c.fillStyle = marks[i] == null ? C.s3 : marks[i] ? C.tint : C.wrong;
      c.fill();
    }
  };
  // Hairline above the rows
  c.fillStyle = C.s2;
  c.fillRect(L, G.rule, R - L, 2);

  ids.forEach((id, n) => {
    const y = G.rows[n];
    if (id === 'col') {
      // College: one square per player
      label('COLLEGE', daily.ptsCol(ds, day), y + 34);
      squares(day.c.map((q, r) => ds.col.a[r] == null ? null : ds.col.a[r] === q[2]), y);
    } else if (id === 'sil') {
      // Faces: one square per silhouette
      const a = (ds.sil && ds.sil.a) || [];
      label('FACES', daily.ptsSil(ds, day), y + 34);
      squares((day.s || []).map((q, r) => a[r] == null ? null : a[r] === q.a), y);
    } else if (id === 'who') {
      // Mystery: seven pips with the solving clue lit, or STUMPED
      label('MYSTERY', daily.ptsWho(ds, day), y + 34);
      if (ds.who.done && !ds.who.won) word('STUMPED', y, C.wrong);
      else {
        const at = ds.who.won ? ds.who.clues : 0;
        for (let i = 1; i <= 7; i++) {
          const cx = R - (7 - i) * G.pip - 20, cy = y + 36;
          c.beginPath();
          c.arc(cx, cy, i === at ? 20 : 14, 0, Math.PI * 2);
          c.fillStyle = i === at ? C.tint : i < at ? C.ink4 : C.s3;
          c.fill();
        }
      }
    } else if (id === 'jr') {
      // Journey: three guesses, the solving one lit (misses in red), or MISSED
      const jr = ds.jr || {g: [], done: false, won: false};
      label('JOURNEY', daily.ptsJr(ds, day), y + 34);
      if (jr.done && !jr.won) word('MISSED', y, C.wrong);
      else {
        const at = daily.jrGuessNo(ds);
        const miss = (jr.g || []).length; // wrong guesses
        for (let i = 1; i <= 3; i++) {
          const cx = R - (3 - i) * 64 - 22, cy = y + 36;
          c.beginPath();
          c.arc(cx, cy, i === at ? 22 : 15, 0, Math.PI * 2);
          c.fillStyle = i === at ? C.tint : i <= miss ? C.wrong : C.s3;
          c.fill();
        }
      }
    } else if (id === 'play') {
      // Name the play: one square per round
      const a = (ds.play && ds.play.a) || [];
      label('PLAYS', daily.ptsPlay(ds, day), y + 34);
      squares(daily.playRounds(day).map((q, r) => a[r] == null ? null : a[r] === q.a), y);
    } else {
      // Grid: its squares in the day's shape (3 x 3, or 1 x 2 on a v3 or v4 day)
      label('GRID', daily.ptsGrid(ds, day), y + 34);
      const step = G.cell + G.cellGap, sh = daily.gridShape(day), nc = sh.cols.length;
      for (let k = 0; k < sh.n; k++) {
        const r = Math.floor(k / nc), cc = k % nc;
        const x = R - (nc - cc) * G.cell - (nc - 1 - cc) * G.cellGap, yy = y + r * step;
        const cell = ds.grid.cells[k];
        rr(c, x, yy, G.cell, G.cell, 12);
        c.fillStyle = !cell ? C.s3 : cell.ok ? C.tint : C.wrong;
        c.fill();
      }
    }
  });

  // Footer: flame + streak · rank, then the short URL
  const bits = [];
  if (streak > 0) bits.push(`${streak}-day streak`);
  if (rank) bits.push(`#${rank} in the league today`);
  const line = bits.join('  ·  ');
  c.textAlign = 'left';
  c.font = `600 34px ${txt}`;
  const fp = streak > 0 ? flamePath() : null;
  const fw = fp ? 44 : 0;
  const tw = c.measureText(line).width;
  const x0 = (W - (fw + (fp ? 12 : 0) + tw)) / 2;
  if (fp) {
    c.save();
    c.translate(x0, 1188);
    c.scale(44 / 24, 44 / 24);
    const g = c.createLinearGradient(0, 24, 0, 0);
    g.addColorStop(0, C.f2); g.addColorStop(1, C.f1);
    c.fillStyle = g;
    c.fill(fp);
    c.restore();
  }
  c.fillStyle = C.ink;
  if (line) c.fillText(line, x0 + fw + (fp ? 12 : 0), 1224);
  c.textAlign = 'center';
  c.fillStyle = C.ink3;
  c.font = `400 28px ${txt}`;
  const url = (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '');
  c.fillText(url, W / 2, 1284);

  if (perfect) {
    c.strokeStyle = C.gold;
    c.lineWidth = 8;
    c.strokeRect(4, 4, W - 8, H - 8);
  }

  return new Promise((res, rej) => {
    try { cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'); } catch (e) { rej(e); }
  });
}
