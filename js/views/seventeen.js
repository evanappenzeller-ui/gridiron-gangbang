// 17-0, the second game of the Daily Games tab (puzzles.js: its picker shows this pane for /puzzles/17-0 and
// /puzzles/17-0/<board>; imported on first use). Build the perfect team: a board is a grid of player-seasons, five
// columns (QB, RB, WR1, WR2, TE) by five prices ($5 down to $1), every player in his prime, each square with his
// headshot and his first and last name. Pick one per column within the $15 budget, then play the season:
// js/core/seventeen.js turns the five seasons into points per game (an EPA model fit on every team-season
// 2006-2025, tools/seventeen/build.py) and plays 17 real teams. Only the perfect lineup goes 17-0; after a season the
// perfect team can be revealed.
//
// A pane module, like League's segments: render(ctx), mount(el, ctx, {anchor}), params(el, ctx) (another board in
// the route), unmount(el, ctx). anchor: the element to keep in view when the pane swaps phases (the game picker).
// Two phases per board (module memory, this page session): 'build' (board chips, the grid, the budget, the
// scouting report of the last player tapped, the lineup bar with Play) and 'season' (the record counting up week by
// week, the lineup's points per game, the perfect team behind a reveal). Picks are kept per board in localStorage.
// The model's own number for a player (imp) is never shown before a season: that is the answer.
// Every control here is data-sv-*, so the Daily Puzzles handlers on the same screen never see these taps.
// Owner: 17-0.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as sv from '../core/seventeen.js';

const esc = data.esc;
const nf = n => data.nf(n);
const COPIED = 'Copied. Paste it in the league chat.';
const LAST_BOARD = 'gg-17-board';
const POS = {QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end'};
const eid = e => String(e || '').replace(/[^0-9]/g, '');
// Headshots: the nflverse-players headshot (p.h, NFL.com's own photo, as nflreadr::load_players() publishes it) first,
// then ESPN's (the image combiner serves the transparent cut-out resized, as in Silhouettes), then a plain player
// silhouette (never initials). The two are framed differently (.is-nfl, .is-espn in seventeen.css). Team logos are a
// background image, so a missing one just isn't there.
const faceUrl = (e, w) => `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${eid(e)}.png&w=${w}&h=${Math.round(w * 436 / 600)}`;
const logoUrl = (f, w) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${String(f).toLowerCase().replace(/[^a-z]/g, '')}.png&w=${w}&h=${w}`;
const money = n => '$' + n;
const signed = (x, dp = 1) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(dp);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** "Amon-Ra St. Brown" -> ["Amon-Ra", "St. Brown"]; "Kenneth Walker III" -> ["Kenneth", "Walker III"]. */
function nameParts(n) {
  const i = String(n).indexOf(' ');
  return i < 0 ? ['', String(n)] : [n.slice(0, i), n.slice(i + 1)];
}

const PHASE = new Map(); // board id -> {season, pick, revealed} while its season is showing
const ST = new WeakMap(); // ctx -> pane state

function colorsOf(p) {
  const c = (sv.DOC && sv.DOC.colors[p.f]) || ['#25366A', '#8A94B8'];
  return `--tc:${c[0]};--ta:${c[1]}`;
}
function boardId(ctx) {
  const want = ctx.params && ctx.params.board;
  if (want && sv.board(want)) return want;
  const last = ui.lsGet(LAST_BOARD);
  if (last && sv.board(last)) return last;
  return sv.boards()[0] ? sv.boards()[0].id : null;
}
const phaseOf = b => PHASE.get(b.id) || null;

// ============================================================================ Markup: build
const ANON = () => `<span class="sv-anon" aria-hidden="true">${ui.icon('silhouette-fill')}</span>`;
/** The headshot: nflverse's (NFL.com), then ESPN's (data-alt), then a silhouette (onImgError swaps them in). */
function faceHTML(p, w) {
  const espn = p.e ? faceUrl(p.e, w) : '';
  if (!p.h && !espn) return ANON();
  const alt = p.h && espn ? ` data-alt="${esc(espn)}"` : '';
  return `<img class="sv-face ${p.h ? 'is-nfl' : 'is-espn'}" src="${esc(p.h || espn)}"${alt} alt="" draggable="false" decoding="async" referrerpolicy="no-referrer">`;
}
function chipsHTML(b) {
  return ui.chips({name: 'sv-board', label: 'Boards', value: b.id, cls: 'sv-chips', items: sv.boards().map(x => {
    const s = sv.saved(x.id);
    return {id: x.id, label: x.name, lead: s.perfect ? ui.icon('trophy', {size: 14, cls: 'sv-chip-ic'}) : ''};
  })});
}
function headHTML(b) {
  return `<header class="sv-head">`
    + `<p class="sv-kick">Build the perfect team with ${money(b.budget)}</p>`
    + `<h2 class="sv-title">${esc(b.name)}</h2>`
    + `<p class="sv-sub">${esc(b.sub)}</p>`
    + ui.iconButton({icon: 'info', label: 'How 17\u20130 works', cls: 'sv-howto', attrs: {'data-sv-help': ''}})
    + `</header>`;
}
function bankHTML(b, pick) {
  const spent = sv.cost(b, pick), left = b.budget - spent;
  const pips = Array.from({length: b.budget}, (_, i) => `<i class="sv-pip${i < spent ? ' is-on' : ''}"></i>`).join('');
  return `<div class="sv-bank${spent === b.budget ? ' is-full' : ''}" data-sv-bank>`
    + `<p class="sv-bank-t"><span class="sv-bank-n" data-sv-left>${money(left)}</span> <span class="sv-bank-l">left of ${money(b.budget)}</span></p>`
    + `<span class="sv-pips" aria-hidden="true">${pips}</span></div>`;
}
/** Would picking (c, r) go over the budget (swapping out whoever is in column c)? */
function overBy(b, pick, c, r) {
  const next = pick.slice();
  next[c] = r;
  return Math.max(0, sv.cost(b, next) - b.budget);
}
function cellLabel(b, c, r, on, over) {
  const p = sv.card(b, c, r);
  return `${p.n}, ${p.y} ${p.tn}, ${b.cols[c]}, ${money(b.tiers[r])}${on ? ', in your lineup' : over ? `, ${money(over)} over budget` : ''}`;
}
// Long names step down a size or two so the whole name fits the square (--n, the length, sizes it to the square's
// width where container queries work: seventeen.css).
const fitCls = (s, a, b) => (s.length > b ? ' is-xlong' : s.length > a ? ' is-long' : '');
function cellHTML(b, c, r, pick) {
  const p = sv.card(b, c, r), on = pick[c] === r, over = on ? 0 : overBy(b, pick, c, r);
  const [first, last] = nameParts(p.n);
  return `<button type="button" class="sv-cell${on ? ' is-on' : ''}${over ? ' is-over' : ''}" data-c="${c}" data-r="${r}" style="${colorsOf(p)}" aria-pressed="${on}" aria-label="${esc(cellLabel(b, c, r, on, over))}">`
    + `<span class="sv-logo" style="background-image:url(${esc(logoUrl(p.f, 80))})" aria-hidden="true"></span>`
    + `<span class="sv-ph" aria-hidden="true">${faceHTML(p, 160)}</span>`
    + `<span class="sv-yr" aria-hidden="true">${p.y}</span>`
    + `<span class="sv-nm" aria-hidden="true"><span class="sv-fn${fitCls(first, 8, 10)}" style="--n:${first.length}">${esc(first)}</span><span class="sv-ln${fitCls(last, 9, 12)}" style="--n:${last.length}">${esc(last)}</span></span>`
    + `<span class="sv-tick" aria-hidden="true">${ui.icon('check', {size: 14})}</span>`
    + `</button>`;
}
function gridHTML(b, pick) {
  let h = `<div class="sv-grid" role="group" aria-label="Players by position and price"><span class="sv-corner" aria-hidden="true"></span>`;
  h += b.cols.map(c => `<span class="sv-ch" aria-hidden="true">${esc(c)}</span>`).join('');
  b.tiers.forEach((t, r) => {
    h += `<span class="sv-price" aria-hidden="true">${money(t)}</span>`;
    for (let c = 0; c < 5; c++) h += cellHTML(b, c, r, pick);
  });
  return h + `</div>`;
}
function scoutHTML(b, pick, foc) {
  if (!foc) {
    return `<section class="card sv-scout is-empty"><p class="sv-sc-hint">${ui.icon('info', {size: 18})}<span>Tap a player to scout his prime. Tap him again to take him out.</span></p></section>`;
  }
  const {c, r} = foc, p = sv.card(b, c, r), on = pick[c] === r, over = on ? 0 : overBy(b, pick, c, r);
  const adv = (p.adv || []).map(([k, v]) => `<div class="sv-sc-a"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const note = on ? `<p class="sv-sc-note is-on">${ui.icon('check-circle', {size: 16})}<span>In your lineup at ${esc(b.cols[c])}.</span></p>`
    : over ? `<p class="sv-sc-note is-over">${ui.icon('lock', {size: 16})}<span>${money(over)} over budget. Free up some money first.</span></p>` : '';
  return `<section class="card sv-scout" aria-label="${esc(`Scouting report: ${p.n}, ${p.y}`)}">`
    + `<div class="sv-sc-top">`
    + `<span class="sv-sc-ph" style="${colorsOf(p)}" aria-hidden="true"><span class="sv-logo" style="background-image:url(${esc(logoUrl(p.f, 120))})"></span>${faceHTML(p, 240)}</span>`
    + `<div class="sv-sc-id"><p class="sv-sc-ovl">${esc(POS[p.p] || p.p)} · ${money(b.tiers[r])}</p>`
    + `<h3 class="sv-sc-n">${esc(p.n)}</h3>`
    + `<p class="sv-sc-t">${esc(`${p.y} ${p.tn} · ${plural(p.g, 'game')}`)}</p></div></div>`
    + `<p class="sv-sc-line">${p.line.map(esc).join(' · ')}</p>`
    + (adv ? `<dl class="sv-sc-adv">${adv}</dl>` : '')
    + note
    + `</section>`;
}
function slotsHTML(b, pick) {
  return b.cols.map((label, c) => {
    const r = pick[c];
    if (r == null) return `<span class="sv-slot is-open"><span class="sv-slot-l">${esc(label)}</span></span>`;
    const p = sv.card(b, c, r);
    return `<button type="button" class="sv-slot" data-sv-slot="${c}" style="${colorsOf(p)}" aria-label="${esc(`${label}: ${p.n} ${p.y}, ${money(b.tiers[r])}. Show him.`)}"><span class="sv-ph">${faceHTML(p, 96)}</span></button>`;
  }).join('');
}
function playLabel(b, pick) {
  const n = pick.filter(r => r == null).length;
  return n ? `Pick ${n} more` : sv.fits(b, pick) ? 'Play the season' : 'Over budget';
}
function barHTML(b, pick) {
  const ready = sv.full(pick) && sv.fits(b, pick);
  return `<div class="sv-bar"><div class="sv-slots" role="group" aria-label="Your lineup">${slotsHTML(b, pick)}</div>`
    + `<button type="button" class="btn btn-primary sv-play" data-sv-play${ready ? '' : ' disabled'}>${ui.icon('play-fill')}<span class="btn-label">${esc(playLabel(b, pick))}</span></button></div>`;
}
function bestLine(b) {
  const s = sv.saved(b.id);
  if (!s.played) return '';
  return `<p class="sv-best">${s.perfect ? ui.icon('trophy', {size: 14}) : ''}<span>${esc(`Best: ${s.best.w}–${s.best.l} · ${plural(s.played, 'season')} played`)}</span></p>`;
}
function buildHTML(b, pick, foc) {
  return chipsHTML(b) + headHTML(b) + bestLine(b) + bankHTML(b, pick) + gridHTML(b, pick)
    + `<div data-sv-scout>${scoutHTML(b, pick, foc)}</div>` + barHTML(b, pick);
}

// ============================================================================ Markup: season
const VERDICT = [
  [17, 'Perfect season. You found the perfect team.'],
  [16, 'One game from perfect.'],
  [14, 'A juggernaut. One swap from history?'],
  [11, 'Playoff team.'],
  [8, 'On the bubble.'],
  [5, 'Rebuilding year.'],
  [0, 'Top-three pick incoming.']
];
const verdict = w => VERDICT.find(([n]) => w >= n)[1];
function lineupHTML(b, pick) {
  return `<ol class="sv-picks">` + pick.map((r, c) => {
    const p = sv.card(b, c, r);
    return `<li class="sv-pk"><span class="sv-pk-ph" style="${colorsOf(p)}" aria-hidden="true">${faceHTML(p, 96)}</span>`
      + `<span class="sv-pk-id"><b>${esc(p.n)}</b><small>${esc(`${b.cols[c]} · ${p.y} ${p.tn} · ${money(b.tiers[r])}`)}</small></span>`
      + `<span class="sv-pk-v${p.imp < 0 ? ' is-neg' : ''}"><b>${esc(signed(p.imp))}</b><small>pts/game</small></span></li>`;
  }).join('') + `</ol>`;
}
function weekHTML(gm) {
  const g = gm.g;
  const c = (sv.DOC.colors[g.f] || ['#25366A'])[0];
  return `<li class="sv-wk ${gm.win ? 'is-w' : 'is-l'}">`
    + `<span class="sv-wk-n">${gm.wk}</span>`
    + `<span class="sv-wk-dot" style="--tc:${esc(c)}" aria-hidden="true"></span>`
    + `<span class="sv-wk-opp"><b>${esc(`${gm.home ? 'vs' : '@'} ${g.y} ${g.tn}`)}</b><small>${esc(g.rec ? `went ${g.rec}` : '')}</small></span>`
    + `<span class="sv-wk-res"><b>${gm.win ? 'W' : 'L'}</b> ${gm.us}–${gm.them}</span></li>`;
}
function perfectHTML(b, ph) {
  const best = sv.best(b), all = sv.all(b);
  if (sv.samePick(best.pick, ph.pick)) {
    const others = all.perfect - 1;
    return `<div class="card sv-perfect is-you"><p class="sv-pf-t">${ui.icon('trophy', {size: 18})}<span>This is the perfect team.</span></p>`
      + `<p class="sv-pf-s">${esc(others > 0 ? `${plural(others, 'other lineup')} also ${others === 1 ? 'goes' : 'go'} 17–0, none score more.` : 'No other lineup under the cap goes 17–0.')}</p></div>`;
  }
  if (!ph.revealed) {
    return `<div class="card sv-perfect"><p class="sv-pf-t">The perfect team</p>`
      + `<p class="sv-pf-s">${esc(`${all.perfect === 1 ? 'One lineup' : plural(all.perfect, 'lineup')} under the cap ${all.perfect === 1 ? 'goes' : 'go'} 17–0. Keep hunting, or see the best one.`)}</p>`
      + `<button type="button" class="btn btn-secondary" data-sv-reveal>${ui.icon('sparkle')}<span class="btn-label">Reveal the perfect team</span></button></div>`;
  }
  const s = sv.season(b, best.pick);
  return `<div class="card sv-perfect is-open"><p class="sv-pf-t">${ui.icon('trophy', {size: 18})}<span>${esc(`The perfect team: ${sv.rec(s)}, ${s.ppg.toFixed(1)} points a game`)}</span></p>`
    + lineupHTML(b, best.pick) + `</div>`;
}
function seasonHTML(b, ph) {
  const s = ph.season, r = sv.rankOf(b, ph.pick), diff = s.pf - s.pa;
  return chipsHTML(b)
    + `<section class="sv-season" aria-labelledby="sv-rec">`
    + `<p class="sv-kick">${esc(`${b.name} · your ${money(sv.cost(b, ph.pick))} team`)}</p>`
    + `<h2 class="sv-rec${s.w === 17 ? ' is-gold' : ''}" id="sv-rec" aria-label="${esc(`Record: ${s.w} and ${s.l}`)}"><span data-sv-w>${s.w}</span>-<span data-sv-l>${s.l}</span></h2>`
    + `<p class="sv-verdict">${esc(verdict(s.w))}</p>`
    + `<div class="tiles tiles-3 sv-tiles">`
    + ui.statTile({label: 'PPG', value: s.ppg.toFixed(1)})
    + ui.statTile({label: 'Point diff', value: (diff >= 0 ? '+' : '−') + nf(Math.abs(diff))})
    + ui.statTile({label: 'Rank', value: '#' + nf(r.rank), sub: `of ${nf(r.of)}`})
    + `</div>`
    + ui.sectionHeader({title: 'Your lineup', level: 3})
    + lineupHTML(b, ph.pick)
    + `<p class="sv-foot">What each prime season adds to the scoreboard every week, over a replacement-level player.</p>`
    + ui.sectionHeader({title: 'Week by week', level: 3})
    + `<ol class="sv-weeks">${s.games.map(weekHTML).join('')}</ol>`
    + `<div data-sv-perfect>${perfectHTML(b, ph)}</div>`
    + `<div class="sv-actions">`
    + `<button type="button" class="btn btn-primary" data-sv-rebuild>${ui.icon('swap')}<span class="btn-label">Rebuild</span></button>`
    + `<button type="button" class="btn btn-secondary" data-sv-share>${ui.icon('share')}<span class="btn-label">Share</span></button>`
    + `</div></section>`;
}

// ============================================================================ Markup: states
function loadingHTML() {
  return `<div class="sv-loading" aria-busy="true">${ui.skeleton('rows', 4, {label: 'Loading 17–0.'})}</div>`;
}
function errorHTML() {
  return ui.empty({icon: 'football', title: '17–0 needs a connection the first time.', action: {label: 'Try again', attrs: {'data-sv-retry': ''}}});
}
function bodyHTML(ctx) {
  if (!sv.DOC) return loadingHTML();
  const b = sv.board(boardId(ctx));
  if (!b) return errorHTML();
  const ph = phaseOf(b);
  if (ph) return seasonHTML(b, ph);
  const st = ST.get(ctx);
  const pick = st && st.b === b ? st.pick : sv.saved(b.id).pick;
  return buildHTML(b, pick, st && st.b === b ? st.foc : null);
}

// ============================================================================ Patching
function patchBuild(st) {
  const {el, b, pick} = st;
  el.querySelectorAll('.sv-cell').forEach(btn => {
    const c = +btn.dataset.c, r = +btn.dataset.r, on = pick[c] === r, over = on ? 0 : overBy(b, pick, c, r);
    btn.classList.toggle('is-on', on);
    btn.classList.toggle('is-over', !!over);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', cellLabel(b, c, r, on, over));
  });
  const spent = sv.cost(b, pick);
  const left = el.querySelector('[data-sv-left]');
  if (left) left.textContent = money(b.budget - spent);
  el.querySelectorAll('.sv-pip').forEach((p, i) => p.classList.toggle('is-on', i < spent));
  const bank = el.querySelector('[data-sv-bank]');
  if (bank) bank.classList.toggle('is-full', spent === b.budget);
  const slots = el.querySelector('.sv-slots');
  if (slots) slots.innerHTML = slotsHTML(b, pick);
  const play = el.querySelector('[data-sv-play]');
  if (play) {
    play.disabled = !(sv.full(pick) && sv.fits(b, pick));
    play.querySelector('.btn-label').textContent = playLabel(b, pick);
  }
  patchScout(st);
  ui.hydrate(el);
}
function patchScout(st) {
  const host = st.el.querySelector('[data-sv-scout]');
  if (host) host.innerHTML = scoutHTML(st.b, st.pick, st.foc);
}

/** A face that failed: ESPN's headshot, then the silhouette. Error events don't bubble: caught in the capture phase. */
function onImgError(e) {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.matches('.sv-face')) return;
  const alt = img.dataset.alt;
  if (alt) {
    img.removeAttribute('data-alt');
    img.classList.replace('is-nfl', 'is-espn');
    img.src = alt;
    return;
  }
  img.insertAdjacentHTML('afterend', ANON());
  img.remove();
}

// ============================================================================ Events
function tapCell(st, btn) {
  const {b, pick} = st;
  const c = +btn.dataset.c, r = +btn.dataset.r;
  st.foc = {c, r};
  if (pick[c] === r) {
    pick[c] = null;
    ui.haptic('selection');
  } else {
    const over = overBy(b, pick, c, r);
    if (over) {
      patchScout(st);
      ui.shake(btn);
      ui.haptic('error');
      ui.announce(`${money(over)} over budget.`);
      return;
    }
    pick[c] = r;
    ui.haptic('light');
    if (!ui.RM) ui.stamp(btn.querySelector('.sv-tick'), {from: .4});
  }
  sv.keepPick(b.id, pick);
  patchBuild(st);
  if (sv.full(pick)) ui.announce(`Lineup set: ${money(sv.cost(b, pick))} of ${money(b.budget)}. Ready to play the season.`);
}

function play(st) {
  const {b, pick} = st;
  if (!sv.full(pick) || !sv.fits(b, pick)) return;
  const s = sv.season(b, pick);
  sv.remember(b.id, pick, s);
  PHASE.set(b.id, {season: s, pick: pick.slice(), revealed: false});
  ui.haptic('medium');
  swapBody(st, () => runSeason(st));
}

function rebuild(st) {
  PHASE.delete(st.b.id);
  st.foc = null;
  swapBody(st);
}

/** Scrolls up so the game picker (opts.anchor, else the pane) sits just under the bar, if it is above the view. */
function toTop(st) {
  const scr = st.ctx.screen, a = st.anchor || st.el;
  if (!scr || !a.isConnected) return;
  const nav = scr.querySelector(':scope > .nav');
  const navH = nav ? nav.offsetHeight : 44;
  const top = a.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop - navH - 8;
  if (scr.scrollTop > top) scr.scrollTop = Math.max(0, top);
}

/** Re-renders the pane for the current phase (crossfade), with the game picker back in view. */
function swapBody(st, after) {
  const {el, ctx} = st;
  const go = () => {
    el.innerHTML = bodyHTML(ctx);
    ui.hydrate(el);
    toTop(st);
    if (after) after();
  };
  if (!ui.RM && ctx.visible) ui.crossfade(el, go, {duration: 160}); else go();
}

/** The season plays out: weeks stamp in one by one while the record counts. Reduced motion: all at once. */
function runSeason(st) {
  const ph = phaseOf(st.b);
  if (!ph) return;
  const s = ph.season;
  const rows = [...st.el.querySelectorAll('.sv-wk')];
  const wEl = st.el.querySelector('[data-sv-w]'), lEl = st.el.querySelector('[data-sv-l]');
  const finish = () => {
    if (st.dead) return;
    if (wEl) wEl.textContent = s.w;
    if (lEl) lEl.textContent = s.l;
    const rec = st.el.querySelector('.sv-rec');
    if (s.w === 17) {
      ui.haptic('celebrate');
      if (rec) {
        ui.stamp(rec, {from: 1.4});
        ui.confetti(rec.getBoundingClientRect(), {colors: ['#FFC531', '#7CF058', '#FFFFFF'], count: 90});
      }
    }
    ui.announce(`Your season: ${s.w} and ${s.l}. ${verdict(s.w)}`);
  };
  if (ui.RM || !st.ctx.visible) { finish(); return; }
  let w = 0, l = 0;
  if (wEl) wEl.textContent = '0';
  if (lEl) lEl.textContent = '0';
  rows.forEach(row => { row.style.opacity = '0'; });
  const STEP = 110;
  rows.forEach((row, i) => {
    const t = setTimeout(() => {
      if (st.dead) return;
      row.style.opacity = '';
      ui.animate(row, [{opacity: 0, transform: 'translateX(-12px)'}, {opacity: 1, transform: 'none'}], {duration: 220, easing: 'cubic-bezier(.22,1,.36,1)'});
      if (s.games[i].win) { w++; if (wEl) wEl.textContent = w; } else { l++; if (lEl) lEl.textContent = l; }
      if (i === rows.length - 1) finish();
    }, 260 + i * STEP);
    st.timers.push(t);
  });
}

function reveal(st) {
  const ph = phaseOf(st.b);
  if (!ph) return;
  ph.revealed = true;
  const host = st.el.querySelector('[data-sv-perfect]');
  if (!host) return;
  const go = () => { host.innerHTML = perfectHTML(st.b, ph); ui.hydrate(host); };
  if (!ui.RM) ui.crossfade(host, go, {duration: 160}); else go();
  ui.haptic('light');
  const card = host.querySelector('.sv-perfect');
  if (card) { card.setAttribute('tabindex', '-1'); try { card.focus({preventScroll: true}); } catch (_) {} }
  ui.announce('The perfect team is showing.');
}

function share(st) {
  const ph = phaseOf(st.b);
  if (!ph) return;
  ui.share({text: sv.shareText(st.b, ph.pick, ph.season)}).then(r => {
    if (r === 'copied') { ui.toast(COPIED, {icon: 'check-circle'}); ui.haptic('success'); }
    else if (r === 'unavailable') ui.toast("Couldn't copy your season.");
  });
}

function onClick(st, e) {
  const t = e.target.closest('.sv-cell, [data-sv-slot], [data-sv-play], [data-sv-rebuild], [data-sv-share], [data-sv-reveal], [data-sv-retry], [data-sv-help]');
  if (!t || !st.el.contains(t)) return;
  if (t.matches('.sv-cell')) { tapCell(st, t); return; }
  if (t.hasAttribute('data-sv-slot')) {
    const c = +t.dataset.svSlot, r = st.pick[c];
    if (r == null) return;
    st.foc = {c, r};
    patchScout(st);
    const cell = st.el.querySelector(`.sv-cell[data-c="${c}"][data-r="${r}"]`);
    if (cell) { try { cell.focus({preventScroll: true}); } catch (_) {} cell.scrollIntoView({block: 'center', behavior: ui.RM ? 'auto' : 'smooth'}); }
    return;
  }
  if (t.hasAttribute('data-sv-play')) { play(st); return; }
  if (t.hasAttribute('data-sv-rebuild')) { rebuild(st); return; }
  if (t.hasAttribute('data-sv-share')) { share(st); return; }
  if (t.hasAttribute('data-sv-reveal')) { reveal(st); return; }
  if (t.hasAttribute('data-sv-help')) { openHelp(); return; }
  if (t.hasAttribute('data-sv-retry')) load(st);
}

function onChange(st, e) {
  if (!e.detail || e.detail.name !== 'sv-board') return;
  e.stopPropagation();
  const id = e.detail.value;
  if (!sv.board(id) || id === (st.b && st.b.id)) return;
  ui.lsSet(LAST_BOARD, id);
  st.ctx.replace('/puzzles/17-0/' + id);
}

function load(st) {
  const {el, ctx} = st;
  el.innerHTML = loadingHTML();
  sv.load().then(() => {
    if (st.dead) return;
    setBoard(st);
    el.innerHTML = bodyHTML(ctx);
    ui.hydrate(el);
  }, () => {
    if (st.dead) return;
    el.innerHTML = errorHTML();
    ui.hydrate(el);
  });
}

function setBoard(st) {
  const b = sv.board(boardId(st.ctx));
  st.b = b;
  st.pick = b ? sv.saved(b.id).pick : sv.empty();
  st.foc = null;
  if (b) ui.lsSet(LAST_BOARD, b.id);
}

// ============================================================================ How it works
function openHelp() {
  const m = sv.DOC && sv.DOC.model;
  const body = `<div class="sv-help">`
    + `<p><b>Pick one player per column</b> and spend no more than the cap. Every card is that player in his prime: the season people remember (2022 Nick Chubb and his 1,525 rushing yards, not 2025 Chubb).</p>`
    + `<p><b>The data.</b> Each season is scored with EPA (expected points added, play by play, from nflverse) over what a replacement-level player would do with the same workload. A completed pass is split: half the credit to the passer, half to the receiver.</p>`
    + `<p><b>The team.</b> A regression on every team-season from 2006 to 2025${m ? ` (${nf(m.n)} of them, R² ${m.r2.toFixed(2)})` : ''} weighs each position and turns your five seasons into points per game. Your defense is league average.</p>`
    + `<p><b>The season.</b> 17 real teams from 2006–2025. Outscore a team and it's a win. Only the perfect lineup runs the table, and week 17 is the toughest team on the slate.</p>`
    + `</div>`;
  ui.openSheet({title: 'How 17–0 works', body, detents: ['fit'], cls: 'sh-seventeen'});
}

// ============================================================================ Pane
export function render(ctx) {
  return bodyHTML(ctx);
}

export function mount(el, ctx, {anchor} = {}) {
  const st = {el, ctx, anchor: anchor || null, b: null, pick: sv.empty(), foc: null, timers: [], dead: false};
  ST.set(ctx, st);
  st.onClick = e => onClick(st, e);
  st.onChange = e => onChange(st, e);
  el.addEventListener('click', st.onClick);
  el.addEventListener('ui:change', st.onChange);
  el.addEventListener('error', onImgError, true);
  if (!sv.DOC) { load(st); return; }
  // render() ran before this state existed: it showed the saved picks, which is what setBoard reads too.
  setBoard(st);
}

/** The route names another board (a chip, a link): that board's phase and picks. */
export function params(el, ctx) {
  const st = ST.get(ctx);
  if (!st || !sv.DOC) return;
  const id = boardId(ctx);
  if (st.b && st.b.id === id) return;
  st.timers.forEach(clearTimeout);
  st.timers = [];
  setBoard(st);
  const go = () => { el.innerHTML = bodyHTML(ctx); ui.hydrate(el); };
  if (!ui.RM && ctx.visible) ui.crossfade(el, go, {duration: 120}); else go();
}

export function unmount(el, ctx) {
  const st = ST.get(ctx);
  if (!st) return;
  st.dead = true;
  st.timers.forEach(clearTimeout);
  el.removeEventListener('click', st.onClick);
  el.removeEventListener('ui:change', st.onChange);
  el.removeEventListener('error', onImgError, true);
  ST.delete(ctx);
}
