// Season in review (#/standings/:year/review): award cards computed from the season, plus "Copy recap".
// Owner: standings package. Spec 7.11. In-progress years redirect to the season page.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import {openMatchup} from './matchup.js';

const esc = data.esc;
const S = new WeakMap();

const f2 = v => data.fmt(v);
const pf2 = v => Number(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const andList = a => a.length <= 1 ? a.join('') : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const ROUND_LC = {quarter: 'quarterfinal', semi: 'semifinal', final: 'championship', third: 'third-place game'};

// ---------------------------------------------------------------- Awards (spec 7.11, in order)
function computeAwards(s) {
  const y = s.year, G = s.games, T = s.table;
  const row = id => T.find(r => r.id === id) || null;
  const rec = r => r ? data.recStr(r.w, r.l, r.t) : '—';
  const gIdx = g => `${y}:${G.indexOf(g)}`;
  const fin = G.find(g => g.type === 'final');
  const third = G.find(g => g.type === 'third');
  const A = [];
  const add = o => { if (o && o.id) A.push(o); };

  // 1-3: the podium
  const ch = row(s.champion), ru = row(s.runnerUp), th = row(s.thirdPlace);
  add({key: 'champion', award: 'Champion', id: s.champion, hero: true, stat: rec(ch), unit: 'record',
    detail: [ch ? `Seed ${ch.seed}.` : '', fin && !fin.tie ? `Beat ${data.name(fin.lose)} ${f2(fin.ws)} to ${f2(fin.ls)} in the championship.` : ''].filter(Boolean).join(' '),
    game: fin ? gIdx(fin) : null});
  add({key: 'runnerUp', award: 'Runner-up', id: s.runnerUp, stat: rec(ru), unit: 'record',
    detail: [ru ? `Seed ${ru.seed}.` : '', fin && !fin.tie ? `Lost the championship ${f2(fin.ls)} to ${f2(fin.ws)}.` : ''].filter(Boolean).join(' ')});
  add({key: 'third', award: 'Third place', id: s.thirdPlace, stat: rec(th), unit: 'record',
    detail: [th ? `Seed ${th.seed}.` : '', third && !third.tie ? `Beat ${data.name(third.lose)} ${f2(third.ws)} to ${f2(third.ls)} for third.` : ''].filter(Boolean).join(' ')});

  // 4-6: the regular season
  const top = T[0];
  if (top) {
    const f = data.finishOf(s, top.id);
    let how = '';
    if (f === 'champion') how = 'Also won the title.';
    else if (f === 'runnerUp') how = 'Lost in the championship.';
    else if (f === 'third') how = 'Finished third.';
    else if (f === 'playoffs') {
      const out = G.filter(g => (g.type === 'quarter' || g.type === 'semi') && !g.tie && g.lose === top.id).pop();
      const fourth = G.some(g => g.type === 'third' && !g.tie && g.lose === top.id);
      how = !out ? 'Went out in the playoffs.'
        : fourth ? `Lost in the ${ROUND_LC[out.type]} and finished fourth.`
        : `Went out in the ${ROUND_LC[out.type]}.`;
    }
    add({key: 'topSeed', award: 'Top seed', id: top.id, stat: rec(top), unit: 'record', detail: [`${pf2(top.pf)} points for.`, how].filter(Boolean).join(' ')});
  }
  if (T.length) {
    const mp = T.reduce((m, r) => r.pf > m.pf ? r : m, T[0]);
    const gp = mp.w + mp.l + mp.t;
    add({key: 'mostPoints', award: 'Most points', id: mp.id, stat: ui.score(mp.pf), unit: 'points for',
      detail: `${gp ? f2(mp.pf / gp) : '0.00'} a game. Went ${rec(mp)}.`, statText: pf2(mp.pf)});
    const un = T.reduce((m, r) => r.pa > m.pa ? r : m, T[0]);
    add({key: 'unluckiest', award: 'Unluckiest', id: un.id, stat: ui.score(un.pa), unit: 'points against',
      detail: `Went ${rec(un)} anyway.`, statText: pf2(un.pa)});
  }

  // 7-10: single games (all of this season's games)
  const sc = G.flatMap(g => [{id: g.a, v: g.sa, opp: g.b, g}, {id: g.b, v: g.sb, opp: g.a, g}]);
  if (sc.length) {
    const hi = sc.reduce((m, x) => x.v > m.v ? x : m, sc[0]);
    const lo = sc.reduce((m, x) => x.v < m.v ? x : m, sc[0]);
    add({key: 'weekHigh', award: 'Week high', id: hi.id, stat: ui.score(hi.v), unit: 'points', detail: `vs ${data.name(hi.opp)}, week ${hi.g.week}`, game: gIdx(hi.g), statText: f2(hi.v)});
    add({key: 'weekLow', award: 'Week low', id: lo.id, stat: ui.score(lo.v), unit: 'points', detail: `vs ${data.name(lo.opp)}, week ${lo.g.week}`, game: gIdx(lo.g), statText: f2(lo.v)});
  }
  const dec = G.filter(g => !g.tie);
  if (dec.length) {
    const bl = dec.reduce((m, g) => g.margin > m.margin ? g : m, dec[0]);
    const nb = dec.reduce((m, g) => g.margin < m.margin ? g : m, dec[0]);
    add({key: 'blowout', award: 'Blowout of the year', id: bl.win, stat: ui.score(bl.margin), unit: 'margin',
      detail: `Beat ${data.name(bl.lose)} ${f2(bl.ws)} to ${f2(bl.ls)}, week ${bl.week}.`, game: gIdx(bl), statText: f2(bl.margin), opp: bl.lose});
    add({key: 'nail', award: 'Nail-biter of the year', id: nb.win, stat: ui.score(nb.margin), unit: 'margin',
      detail: `Beat ${data.name(nb.lose)} ${f2(nb.ws)} to ${f2(nb.ls)}, week ${nb.week}.`, game: gIdx(nb), statText: f2(nb.margin)});
  }

  // 11-14: everything else
  let best = {n: 0};
  T.forEach(r => {
    let n = 0, from = 0;
    G.filter(g => g.reg && (g.a === r.id || g.b === r.id)).forEach(g => {
      if (!g.tie && g.win === r.id) { if (!n) from = g.week; n++; if (n > best.n) best = {n, id: r.id, from, to: g.week}; }
      else n = 0;
    });
  });
  if (best.n) add({key: 'streak', award: 'Hottest streak', id: best.id, stat: String(best.n), unit: best.n === 1 ? 'straight win' : 'straight wins', detail: best.from === best.to ? `Week ${best.from}.` : `Weeks ${best.from}–${best.to}.`});

  const trades = (data.DATA.trades || []).filter(t => t.year === y);
  if (trades.length) {
    const cnt = {}, partners = {};
    trades.forEach(t => (t.sides || []).forEach(sd => {
      cnt[sd.manager] = (cnt[sd.manager] || 0) + 1;
      const p = partners[sd.manager] || (partners[sd.manager] = new Set());
      t.sides.forEach(o => { if (o.manager !== sd.manager) p.add(o.manager); });
    }));
    const ranked = Object.keys(cnt).filter(id => data.M[id]).sort((a, b) => cnt[b] - cnt[a] || data.name(a).localeCompare(data.name(b)));
    const tr = ranked[0];
    if (tr) {
      const ps = [...partners[tr]].filter(id => data.M[id]).map(id => data.name(id));
      add({key: 'trader', award: 'Most active trader', id: tr, stat: String(cnt[tr]), unit: cnt[tr] === 1 ? 'trade' : 'trades', detail: ps.length ? `Dealt with ${andList(ps)}.` : ''});
    }
  }

  const dr = (data.DATA.drafts || []).find(d => d.year === y);
  const p1 = dr && (dr.picks || []).find(p => p.round === 1 && p.pick === 1);
  if (p1 && data.M[p1.manager]) add({key: 'firstPick', award: 'First pick', id: p1.manager, stat: '1.01', unit: 'first overall', detail: `Took ${p1.player}.`, player: p1.player});

  const an = row(s.lastPlace);
  if (an) add({key: 'anchor', award: 'The Anchor', id: an.id, anchor: true, stat: rec(an), unit: 'worst record', detail: `Seed ${an.seed}. ${pf2(an.pf)} points for.`});
  return A;
}

const GROUPS = [
  {title: 'The podium', keys: ['champion', 'runnerUp', 'third']},
  {title: 'The regular season', keys: ['topSeed', 'mostPoints', 'unluckiest']},
  {title: 'Games of the year', keys: ['weekHigh', 'weekLow', 'blowout', 'nail']},
  {title: 'Also receiving votes', keys: ['streak', 'trader', 'firstPick', 'anchor']}
];

// ---------------------------------------------------------------- Markup
function cardHtml(s, a) {
  const nm = data.name(a.id), tm = data.teamIn(s, a.id);
  const c = data.color(a.id).cls;
  const tag = a.game ? 'button' : 'a';
  const act = a.game ? ` type="button" data-game="${esc(a.game)}" aria-haspopup="dialog"` : ` href="#/managers/${esc(a.id)}"`;
  const statTxt = a.statText || String(a.stat).replace(/<[^>]*>/g, '');
  const label = `${a.award}: ${nm}, ${tm}. ${statTxt} ${a.unit}. ${a.detail}`;
  const av = a.hero
    ? ui.avatar(a.id, {size: 72, hero: true, champ: true, crown: true})
    : ui.avatar(a.id, {size: 40, attrs: a.game ? null : {'data-morph-from': ''}});
  return `<${tag} class="rv-card ${c}${a.hero ? ' is-hero' : ''}${a.anchor ? ' is-anchor' : ''}"${act} data-enter aria-label="${esc(label)}">`
    + `<span class="rv-ovl">${a.anchor ? ui.icon('anchor', {size: 13}) : a.hero ? ui.icon('trophy-fill', {size: 13}) : ''}${esc(a.award)}</span>`
    + `<span class="rv-top">${av}<span class="rv-who"><span class="rv-name">${esc(nm)}</span><span class="rv-team">${esc(tm)}</span>${a.hero ? ui.badge('champ') : ''}</span>`
    + `<span class="rv-stat"><span class="n3">${a.stat}</span><span class="rv-unit">${esc(a.unit)}</span></span></span>`
    + (a.detail ? `<span class="rv-detail">${esc(a.detail)}</span>` : '')
    + ui.icon('chevron-right', {cls: 'chev rv-chev'})
    + `</${tag}>`;
}

function dek(s) {
  const fin = s.games.find(g => g.type === 'final');
  const c = s.champion;
  if (!c) return '';
  const base = `${data.name(c)} won it all as ${data.teamIn(s, c)}`;
  return fin && !fin.tie && s.runnerUp ? `${base}, beating ${data.name(s.runnerUp)} ${f2(fin.ws)} to ${f2(fin.ls)}.` : `${base}.`;
}

function recapText(s, A) {
  const by = k => A.find(a => a.key === k);
  const L = [];
  L.push(`${s.year} in review: ${dek(s)}`);
  const ts = by('topSeed'), mp = by('mostPoints');
  const l2 = [ts ? `Top seed: ${data.name(ts.id)} (${ts.stat})` : '', mp ? `Most points: ${data.name(mp.id)} (${mp.statText})` : ''].filter(Boolean);
  if (l2.length) L.push(l2.join('. ') + '.');
  const hi = by('weekHigh'), bl = by('blowout');
  const l3 = [hi ? `Week high: ${data.name(hi.id)} ${hi.statText}, ${hi.detail}` : '', bl ? `Blowout of the year: ${data.name(bl.id)} beat ${data.name(bl.opp)} by ${bl.statText}` : ''].filter(Boolean);
  if (l3.length) L.push(l3.join('. ') + '.');
  const an = by('anchor');
  if (an) L.push(`The Anchor: ${data.name(an.id)} (${an.stat}).`);
  return L.slice(0, 4).join('\n') + '\n' + ui.absLink(`/standings/${s.year}/review`);
}

function renderReview(y) {
  const s = data.seasonByYear(y);
  if (!s) {
    const sp = data.span;
    return ui.empty({icon: 'calendar', title: `No ${y} season.`, body: sp.first != null ? `The league's history runs ${sp.first}–${sp.last}.` : '', action: {label: 'Back', attrs: 'data-back'}});
  }
  if (s.live || !s.champion) {
    // In progress: the season page replaces this screen right after mount.
    return ui.largeTitle({eyebrow: 'Season recap', title: `${y} in review`}) + `<div class="mt-16">${ui.skeleton('cards', 3, {label: 'Opening the season page.'})}</div>`;
  }
  const A = computeAwards(s);
  const by = new Map(A.map(a => [a.key, a]));
  const groups = GROUPS.map(gr => {
    const cards = gr.keys.map(k => by.get(k)).filter(Boolean);
    if (!cards.length) return '';
    return `<section class="rv-group">${ui.sectionHeader({title: gr.title})}<div class="rv-list">${cards.map(a => cardHtml(s, a)).join('')}</div></section>`;
  }).join('');
  return ui.largeTitle({eyebrow: 'Season recap', title: `${y} in review`})
    + `<p class="rv-dek">${esc(dek(s))}</p>`
    + groups
    + `<div class="rv-foot">${ui.button({label: 'Copy recap', kind: 'secondary', icon: 'copy', attrs: {'data-copy': ''}})}</div>`;
}

export default {
  id: 'review',
  title: ctx => `${ctx.params && ctx.params.year != null ? ctx.params.year : ''} in review`,
  render(ctx) {
    return renderReview(Number(ctx.params.year));
  },
  mount(el, ctx) {
    const y = Number(ctx.params.year);
    S.set(ctx, {el, y});
    const s = data.seasonByYear(y);
    if (s && (s.live || !s.champion)) { ctx.replace(`/standings/${y}`); return; }
    el.addEventListener('click', e => {
      const t = e.target;
      if (!t || !t.closest) return;
      const g = t.closest('[data-game]');
      if (g) {
        const [yy, i] = g.dataset.game.split(':').map(Number);
        const ss = data.seasonByYear(yy);
        if (ss && ss.games[i]) { ui.haptic('light'); openMatchup(ss.games[i], ctx); }
        return;
      }
      const cp = t.closest('[data-copy]');
      if (cp) {
        const cur = data.seasonByYear(S.get(ctx).y);
        if (!cur) return;
        const text = recapText(cur, computeAwards(cur));
        ui.copyText(text).then(ok => {
          if (ok) { ui.haptic('success'); ui.toast('Recap copied.', {icon: 'check-circle'}); }
          else ui.toast("Couldn't copy the recap.");
        });
      }
    });
    if (ctx.first) ui.stagger(el);
  },
  update(ctx) {
    const st = S.get(ctx);
    if (!st) return;
    const y = Number(ctx.params.year);
    st.y = y;
    const s = data.seasonByYear(y);
    if (s && (s.live || !s.champion)) { ctx.replace(`/standings/${y}`); return; }
    const sc = ctx.screen, top = sc ? sc.scrollTop : 0;
    st.el.innerHTML = renderReview(y);
    if (sc) sc.scrollTop = top;
  }
};
