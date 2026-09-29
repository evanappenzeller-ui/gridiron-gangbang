// PNG share card (spec 7.7), 1080×1350, drawn on a canvas. renderShareCard(opts) → Promise<Blob>.
// Colors come from the design tokens at runtime; the league name, day, marks, streak and rank from live data.
// Owner: daily-hub package.
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
  const total = daily.totalPts(ds, day);
  const grade = daily.gradeFor(total);
  const perfect = total >= 1000;
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

  // Overline + date
  const league = (data.DATA && data.DATA.league && data.DATA.league.name) || 'Gridiron Gangbang';
  const ovl = `${league} · Daily #${pnum}`.toUpperCase();
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

  // Total, "of 1,000", grade
  c.fillStyle = C.ink;
  c.font = `800 260px ${NUM}`;
  c.fillText(data.nf(total), W / 2, 468);
  c.fillStyle = C.ink3;
  c.font = `800 40px ${NUM}`;
  spacing(c, 2);
  c.fillText('OF 1,000', W / 2, 526);
  spacing(c, 6);
  c.fillStyle = total >= 850 ? C.gold : C.ink2;
  c.font = `800 56px ${NUM}`;
  c.fillText(grade, W / 2, 612);
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
  // Hairline above the rows
  c.fillStyle = C.s2;
  c.fillRect(L, 668, R - L, 2);

  // College: five 72px squares
  let y = 706;
  label('COLLEGE', daily.ptsCol(ds, day), y + 34);
  const col = day.c.map((q, r) => ds.col.a[r] == null ? null : ds.col.a[r] === q[2]);
  for (let i = 0; i < 5; i++) {
    const x = R - (5 - i) * 72 - (4 - i) * 14;
    rr(c, x, y, 72, 72, 16);
    c.fillStyle = col[i] == null ? C.s3 : col[i] ? C.tint : C.wrong;
    c.fill();
  }

  // Mystery: seven pips with the solving clue lit, or STUMPED
  y = 826;
  label('MYSTERY', daily.ptsWho(ds), y + 34);
  if (ds.who.done && !ds.who.won) {
    c.textAlign = 'right';
    spacing(c, 4);
    c.fillStyle = C.wrong;
    c.font = `800 56px ${NUM}`;
    c.fillText('STUMPED', R, y + 56);
    spacing(c, 0);
  } else {
    const at = ds.who.won ? ds.who.clues : 0;
    for (let i = 1; i <= 7; i++) {
      const cx = R - (7 - i) * 56 - 20, cy = y + 36;
      c.beginPath();
      c.arc(cx, cy, i === at ? 20 : 14, 0, Math.PI * 2);
      c.fillStyle = i === at ? C.tint : i < at ? C.ink4 : C.s3;
      c.fill();
    }
  }

  // Grid: 3×3 of 56px squares
  y = 928;
  label('GRID', daily.ptsGrid(ds), y + 34);
  for (let k = 0; k < 9; k++) {
    const r = Math.floor(k / 3), cc = k % 3;
    const x = R - (3 - cc) * 56 - (2 - cc) * 10, yy = y + r * 66;
    const cell = ds.grid.cells[k];
    rr(c, x, yy, 56, 56, 12);
    c.fillStyle = !cell ? C.s3 : cell.ok ? C.tint : C.wrong;
    c.fill();
  }

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
