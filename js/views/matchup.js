// Matchup sheet (.sh-matchup): hero score bug, records entering the game, all-time series, links.
// Owner: standings package. Spec 7.10 (Matchup sheet). Also exports small score-bug helpers the season page uses.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = data.esc;

/** Round names for overlines and card footers (regular games carry no round name). */
export const ROUND_NAME = {quarter: 'Quarterfinal', semi: 'Semifinal', final: 'Championship', third: 'Third place', consol: 'Consolation'};

/** {id: seed} from a season's regular-season table. */
export function seedsOf(s) {
  const m = {};
  if (s && s.table) s.table.forEach(r => { m[r.id] = r.seed; });
  return m;
}

/** Puts a small gold crown after the winner's name in a scoreBug() string (championship games). */
export function crownWinner(html) {
  return String(html).replace(/(<span class="bug-side is-win">[\s\S]*?<b>[^<]*<\/b>)/, `$1${ui.icon('crown', {size: 14, cls: 'c-crown', label: 'Champion'})}`);
}

/** Badge kinds for a game: WEEK HIGH (holds the week's top score), BLOWOUT (50+), NAIL-BITER (under 2, not a tie). */
export function gameBadges(g, weekGames) {
  const out = [];
  const top = Math.max(...(weekGames && weekGames.length ? weekGames : [g]).map(x => Math.max(x.sa, x.sb)));
  if (Math.max(g.sa, g.sb) === top && weekGames && weekGames.length > 1) out.push('high');
  // Compare the margin in whole cents: 150.20 - 100.20 is 49.999999999999986 in floating point.
  const c = Math.round(Math.abs(g.sa - g.sb) * 100);
  if (c && c >= 5000) out.push('blowout');
  if (c && c < 200) out.push('nail');
  return out;
}

function recOf(w, l, t) { return {w, l, t, rec: data.recStr(w, l, t), p: (w + l + t) ? (w + t / 2) / (w + l + t) : null}; }

// Regular-season record before this week; for playoff and consolation games the final regular-season record plus seed.
export function enteringRecord(s, g, id) {
  if (!s) return Object.assign(recOf(0, 0, 0), {seed: null, rec: '—'});
  const reg = !g.type || g.type === 'reg';
  if (reg) {
    let w = 0, l = 0, t = 0;
    s.games.forEach(x => {
      if (!(!x.type || x.type === 'reg') || x.week >= g.week || (x.a !== id && x.b !== id)) return;
      if (x.sa === x.sb) t++;
      else if ((x.sa > x.sb ? x.a : x.b) === id) w++;
      else l++;
    });
    return Object.assign(recOf(w, l, t), {seed: null});
  }
  const r = s.table.find(x => x.id === id);
  return r ? Object.assign(recOf(r.w, r.l, r.t), {seed: r.seed}) : Object.assign(recOf(0, 0, 0), {seed: null, rec: '—'});
}

function overline(g) {
  const reg = !g.type || g.type === 'reg';
  return [reg ? '' : ROUND_NAME[g.type] || '', `Week ${g.week}`, String(g.year)].filter(Boolean).join(' · ');
}

function seriesHtml(a, b) {
  const h = data.h2hC(a, b);
  const n = h.games.length;
  const cA = data.color(a).cls, cB = data.hueClose(a, b) ? 'mc-ink' : data.color(b).cls;
  const lead = h.aw === h.bw ? 0 : h.aw > h.bw ? 1 : -1;
  const cap = lead === 0 ? `Even at ${h.aw}–${h.bw}` : lead > 0 ? `${data.name(a)} leads ${h.aw}–${h.bw}` : `${data.name(b)} leads ${h.bw}–${h.aw}`;
  const extra = [`${n} meeting${n === 1 ? '' : 's'}`];
  if (h.t) extra.push(`${h.t} tied`);
  const share = n ? (h.aw + h.t / 2) / n : .5;
  const side = (k, id, w, cls, on) => `<div class="mu-sv ${k} ${cls}${on ? ' is-lead' : ''}">${ui.avatar(id, {size: 28})}<span class="n3">${w}</span></div>`;
  return `<div class="mu-series" role="img" aria-label="${esc(`All-time series: ${cap}, ${extra.join(', ')}`)}">`
    + `<div class="mu-sb" aria-hidden="true">${side('a', a, h.aw, cA, lead >= 0)}<span class="mu-vs ovl">Series</span>${side('b', b, h.bw, cB, lead <= 0)}</div>`
    + `<div aria-hidden="true">${ui.splitBar(a, b, share)}</div>`
    + `<p class="mu-cap" aria-hidden="true"><b>${esc(cap)}</b> · ${esc(extra.join(' · '))}</p></div>`;
}

/**
 * Open the matchup sheet for a GAMES entry {a, b, sa, sb, week, year, type}. ctx is the calling screen's ctx
 * (used for navigation). Returns the sheet handle.
 */
export function openMatchup(game, ctx) {
  const g = game;
  if (!g) return null;
  const s = data.seasonByYear(g.year);
  const a = g.a, b = g.b;
  const reg = !g.type || g.type === 'reg';
  const seeds = !reg && s ? seedsOf(s) : null;
  let bug = ui.scoreBug(g, {hero: true, teams: true, seeds, year: g.year, cls: 'mu-bug'});
  if (g.type === 'final' && g.sa !== g.sb) bug = crownWinner(bug);
  const weekGames = s ? s.games.filter(x => x.week === g.week) : [g];
  const badges = gameBadges(g, weekGames).map(k => ui.badge(k)).join('');

  const ra = enteringRecord(s, g, a), rb = enteringRecord(s, g, b);
  const better = ra.p == null || rb.p == null || ra.p === rb.p ? null : ra.p > rb.p ? 'a' : 'b';
  const sub = (id, r) => r.seed != null ? `${data.name(id)} · seed ${r.seed}` : data.name(id);
  const recLabel = reg ? (g.week === 1 ? 'Season opener' : `Before week ${g.week}`) : 'Regular season';
  const tape = ui.tape({label: recLabel, a: ra.rec, b: rb.rec, aSub: sub(a, ra), bSub: sub(b, rb), better, aId: a, bId: b});

  const ovl = overline(g);
  const body = `<div class="mu">`
    + `<div class="mu-hero${g.type === 'final' ? ' is-final' : ''}">${bug}${badges ? `<div class="mu-badges">${badges}</div>` : ''}</div>`
    + `<h3 class="mu-h">Records entering the game</h3><div class="mu-box">${tape}</div>`
    + `<h3 class="mu-h">All-time series</h3><div class="mu-box mu-pad">${seriesHtml(a, b)}</div>`
    + `<div class="mu-actions">${ui.button({label: 'Full rivalry', kind: 'secondary', icon: 'versus', attrs: {'data-mu': 'rivalry'}})}`
    + `<div class="mu-profiles">${ui.button({label: `${data.name(a)}'s profile`, kind: 'plain', attrs: {'data-mu': 'a'}})}${ui.button({label: `${data.name(b)}'s profile`, kind: 'plain', attrs: {'data-mu': 'b'}})}</div></div>`
    + `</div>`;

  const sh = ui.openSheet({
    header: `<span class="ovl mu-ovl">${esc(ovl)}</span>`,
    label: `${ovl}: ${data.name(a)} ${data.fmt(g.sa)}, ${data.name(b)} ${data.fmt(g.sb)}`,
    // Spec 7.10: medium. The hero, badges and entering records rest at medium; the series and links are one drag up.
    body, cls: 'sh-matchup', detents: ['medium', 'large']
  });
  // Navigate through the calling screen (serial queue); without a ctx fall back to the app router.
  const go = (path, o) => (ctx && ctx.nav ? ctx.nav(path, o) : import('../app.js').then(m => m.nav(path, o)));
  sh.body.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-mu]');
    if (!t || !sh.open) return;
    const k = t.dataset.mu;
    if (k === 'rivalry') {
      sh.close();
      go(`/matchup/${a}-vs-${b}`);
    } else if (k === 'a' || k === 'b') {
      const id = k === 'a' ? a : b;
      const sides = sh.body.querySelectorAll('.mu-bug .bug-side');
      const av = sides[k === 'a' ? 0 : 1] && sides[k === 'a' ? 0 : 1].querySelector('.av');
      sh.close();
      go('/managers/' + id, av ? {morphFrom: av} : undefined);
    }
  });
  ui.splitIn(sh.body.querySelector('.split'));
  return sh;
}
