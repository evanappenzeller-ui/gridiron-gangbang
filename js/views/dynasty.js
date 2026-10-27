// Gridiron Dynasty's page (/puzzles/dynasty, pushed over Daily Games; core/dynasty.js has the game): five panes under
// a segmented control. Home (your coins, today's free pack, your unopened packs, collections to claim, your latest
// pulls and what the Daily Games paid), Store (the packs and their odds), Cards (your collection, every card in the game
// to look through, and the collections: The Show's), Squad (your 23 starters: tap a slot to change it) and Play (three
// games a day against the computer, one against each other player's squad, and the Dynasty board: everyone's, the
// scoreboards' rule, CLAUDE.md).
// A pack opens over everything (openPack): the pack torn, then its cards face down, each glowing its rarity's colour
// before it turns (The Show's tell), a Diamond with a burst; then the lot, new and duplicate marked.
// A game plays out over everything too (playOut): the scoreboard and the drives one by one, then the final and the pay.
// The cards themselves (cardHTML) are drawn in HTML: the rarity's frame, the team's colours, the photo (ESPN's headshot,
// else NFL.com's; a Legend his number), OVR, position, the series and the name.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as D from '../core/dynasty.js';

const esc = data.esc, nf = n => data.nf(n);
const ST = new WeakMap();
const TABS = [{id: 'home', label: 'Home'}, {id: 'store', label: 'Store'}, {id: 'cards', label: 'Cards'}, {id: 'squad', label: 'Squad'}, {id: 'play', label: 'Play'}];
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------------------------------- pictures
export const headUrl = (h, w = 300) => {
  const s = String(h || '');
  if (!s) return '';
  if (s.startsWith('n:')) return `https://static.www.nfl.com/image/upload/f_auto,q_auto,w_${w}/league/${encodeURIComponent(s.slice(2))}`;
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${s.replace(/[^0-9]/g, '')}.png&w=${w}&h=${Math.round(w * 436 / 600)}`;
};
export const logoUrl = (abbr, w = 80) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${String(D.teamOf(abbr).espn || abbr).toLowerCase()}.png&w=${w}&h=${w}`;
const coin = n => `<span class="dy-coins"><i class="dy-coin" aria-hidden="true"></i><b>${nf(n)}</b><span class="sr-only"> coins</span></span>`;

// ---------------------------------------------------------------------------------------------------- a card
/** A card. o: {size: 's'|'m'|'l', count (copies held), ghost (not held), isNew, tag (a button: data-dy-card)}. */
export function cardHTML(c, o = {}) {
  if (!c) return '';
  const T = D.teamOf(c.team), [first, last] = D.nameParts(c.name), S = D.SERIES[c.s];
  const photo = c.head ? `<img class="dy-c-ph" src="${esc(headUrl(c.head, o.size === 'l' ? 520 : 300))}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : '';
  const legend = c.s === 'X' ? `<span class="dy-c-num" aria-hidden="true">${c.num}</span>` : '';
  const sub = c.t ? c.t : `${T.abbr} · #${c.num || '–'}`;
  const label = `${c.name}, ${c.o} ${S.name} ${D.POS_NAME[c.pos] || c.pos}, ${D.RARITY_NAME[c.r]}${c.s === 'L' || c.s === 'R' ? `, ${T.name}` : ''}${o.count > 1 ? `, ${o.count} copies` : ''}${o.ghost ? ', not in your collection' : ''}`;
  const inner = `<span class="dy-c-frame" aria-hidden="true"></span><span class="dy-c-art" aria-hidden="true">${legend}${photo}</span>`
    + `<span class="dy-c-top" aria-hidden="true"><b class="dy-c-ovr">${c.o}</b><span class="dy-c-pos">${esc(c.pos)}</span>`
    + `<img class="dy-c-logo" src="${esc(logoUrl(c.team))}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()"></span>`
    + `<span class="dy-c-ser" aria-hidden="true">${esc(S.short)}</span>`
    + `<span class="dy-c-name" aria-hidden="true"><small>${esc(first)}</small><b>${esc(last)}</b></span>`
    + `<span class="dy-c-sub" aria-hidden="true">${esc(sub)}</span>`
    + (o.isNew ? '<span class="dy-c-new" aria-hidden="true">NEW</span>' : '')
    + (o.count > 1 ? `<span class="dy-c-cnt" aria-hidden="true">×${o.count}</span>` : '')
    + '<span class="dy-c-shine" aria-hidden="true"></span>';
  const cls = `dy-card is-${c.r} s-${c.s} sz-${o.size || 'm'}${o.ghost ? ' is-ghost' : ''}${o.cls ? ' ' + o.cls : ''}`;
  const style = `--tp:${T.pri};--ts:${T.sec}`;
  return o.tag === false ? `<div class="${cls}" style="${style}" role="img" aria-label="${esc(label)}">${inner}</div>`
    : `<button type="button" class="${cls}" style="${style}" data-dy-card="${esc(c.id)}" aria-label="${esc(label)}">${inner}</button>`;
}
/** A card's back: its attributes and its real stat lines. */
function backHTML(c) {
  const keys = D.attrKeys(c.pos), T = D.teamOf(c.team);
  const bars = keys.map((k, i) => {
    const v = c.a[i] || 0;
    return `<li><span>${esc(D.ATTR_NAME[k] || k)}</span><i class="dy-bar"><b class="is-${D.rarityOf(v)}" style="width:${v}%"></b></i><em>${v}</em></li>`;
  }).join('');
  const lines = [];
  if (c.s === 'X') lines.push(['Career', c.ln[0]]);
  else if (c.s === 'G') lines.push([c.t, c.ln[0]]);
  else if (c.s === 'A') lines.push([c.t, c.ln[0]], ['2025 season', c.ln[1]]);
  else { if (c.ln[0]) lines.push([`${D.DATA.season} so far`, c.ln[0]]); if (c.ln[1]) lines.push([`${D.DATA.season - 1} season`, c.ln[1]]); }
  const facts = [D.POS_NAME[c.pos], c.s === 'X' ? `Legend of the ${T.name}` : T.name, c.college ? c.college : '', c.exp ? `${c.exp} yr${c.exp === 1 ? '' : 's'} pro` : c.s === 'X' ? '' : 'Rookie']
    .filter(Boolean).join(' · ');
  return `<div class="dy-back"><p class="dy-back-f">${esc(facts)}</p><ul class="dy-attrs">${bars}</ul>`
    + (lines.length ? `<dl class="dy-lines">${lines.filter(l => l[1]).map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '')
    + `<p class="dy-back-s">${esc(D.SERIES[c.s].name)} · ${esc(D.RARITY_NAME[c.r])}${c.s === 'L' ? '' : ` · ${esc(D.SERIES[c.s].blurb)}`}</p></div>`;
}
/** A card up close: the card, its back, and what you can do with it. */
function cardSheet(st, id) {
  const c = D.card(id);
  if (!c) return;
  const s = D.mine(), n = s.o[id] || 0, inSq = Object.values(s.sq).includes(id);
  D.markSeen([id]);
  const sellN = n - (inSq ? 1 : 0);
  const acts = [];
  if (sellN > 0) acts.push(ui.button({label: `Quick sell for ${nf(D.sellValue(c))}`, kind: 'secondary', block: true, attrs: {'data-dy-sell': id}}));
  if (n > 0 && !inSq) acts.push(ui.button({label: 'Put in my squad', kind: 'primary', block: true, attrs: {'data-dy-start': id}}));
  const body = `<div class="dy-sheet-card">${cardHTML(c, {size: 'l', tag: false, ghost: !n})}</div>`
    + `<p class="dy-own">${n ? `In your collection${n > 1 ? ` · ${n} copies` : ''}${inSq ? ' · in your squad' : ''}` : 'Not in your collection yet'}</p>`
    + backHTML(c) + (acts.length ? `<div class="dy-acts">${acts.join('')}</div>` : '');
  const sh = ui.openSheet({title: c.name, body, cls: 'dy-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const sb = e.target.closest('[data-dy-sell]');
    if (sb) {
      const r = D.sell(id, 1);
      if (r.ok) { ui.haptic('success'); ui.toast(`Sold for ${nf(r.coins)} coins`, {icon: 'check-circle'}); sh.close(); refresh(st); }
      return;
    }
    const pb = e.target.closest('[data-dy-start]');
    if (pb) {
      const s2 = D.mine(), slots = D.SLOTS.filter(x => x.pos === c.pos);
      // (the weakest slot of its position, or one where the same player is)
      const same = slots.find(x => D.card(s2.sq[x.id]) && D.card(s2.sq[x.id]).p === c.p);
      const target = same || slots.slice().sort((a, b) => (D.card(s2.sq[a.id])?.o || 0) - (D.card(s2.sq[b.id])?.o || 0))[0];
      if (target && D.setSlot(target.id, id)) { ui.haptic('success'); ui.toast(`${c.name} starts at ${target.id}`, {icon: 'check-circle'}); sh.close(); refresh(st); }
    }
  });
}

// ---------------------------------------------------------------------------------------------------- a pack
function packHTML(kind, {count, big} = {}) {
  const P = D.PACKS[kind];
  return `<span class="dy-pack${big ? ' is-big' : ''}" style="--pc:${P.color}" aria-hidden="true"><span class="dy-pack-foil"></span>`
    + `<span class="dy-pack-top">GRIDIRON<br>DYNASTY</span><span class="dy-pack-name">${esc(P.name.replace(' Pack', ''))}</span>`
    + `<span class="dy-pack-crimp"></span>${count > 1 ? `<span class="dy-pack-n">×${count}</span>` : ''}</span>`;
}

// ---------------------------------------------------------------------------------------------------- panes
function walletHTML(s) {
  const E = D.earned(s), today = Object.values(E.today).reduce((a, b) => a + b, 0);
  return `<div class="dy-wallet">${coin(D.balance(s))}<span class="dy-wallet-s">${today ? `+${nf(today)} from today’s games` : 'Play the Daily Games to earn coins'}</span></div>`;
}
function homeHTML(st) {
  const s = D.mine(), R = D.squadRating(s.sq), packs = D.PACK_ORDER.filter(k => s.pk[k] > 0), ready = D.claimable(s);
  const daily = D.dailyReady(s);
  let h = '';
  if (daily) h += `<button type="button" class="dy-daily" data-dy-daily>${packHTML(D.DAILY_PACK)}<span><b>Your free pack is here</b><small>A Standard Pack every day. Tap to take it.</small></span>${ui.icon('chevron-right')}</button>`;
  if (ready.length) h += `<button type="button" class="dy-ready" data-dy-goto="cols">${ui.icon('trophy')}<span><b>${ready.length === 1 ? 'A collection is' : `${ready.length} collections are`} complete</b><small>Claim ${esc(D.rewardText(ready[0].reward))}${ready.length > 1 ? ' and more' : ''}</small></span>${ui.icon('chevron-right')}</button>`;
  h += `<section class="dy-sec"><h2 class="dy-h">Your packs</h2>`;
  h += packs.length ? `<div class="dy-packs" data-hscroll>${packs.map(k => `<button type="button" class="dy-packb" data-dy-open="${k}">${packHTML(k, {count: s.pk[k]})}<span>${esc(D.PACKS[k].name)}</span><b>Open</b></button>`).join('')}</div>`
    : `<p class="dy-note">No packs to open. Get one in the Store${daily ? ', or take today’s free one' : ''}.</p>${ui.button({label: 'Go to the Store', kind: 'secondary', size: 's', attrs: {'data-dy-tab': 'store'}})}`;
  h += '</section>';
  h += `<section class="dy-sec"><h2 class="dy-h">${esc(D.teamName(s))}</h2><button type="button" class="dy-team" data-dy-tab="squad">`
    + `<span class="dy-ovr is-${D.rarityOf(R.ovr)}"><b>${R.ovr}</b><small>OVR</small></span>`
    + `<span class="dy-team-r"><span>Offense <b>${R.off}</b></span><span>Defense <b>${R.def}</b></span><span>Record <b>${s.rec.w}–${s.rec.l}</b></span></span>${ui.icon('chevron-right')}</button></section>`;
  const lp = s.lp.filter(id => D.card(id)).slice(0, 12);
  if (lp.length) h += `<section class="dy-sec"><h2 class="dy-h">Latest pulls</h2><div class="dy-rail" data-hscroll>${lp.map(id => cardHTML(D.card(id), {size: 's', isNew: D.isNew(id, s)})).join('')}</div></section>`;
  h += earnHTML(s);
  return h;
}
function earnHTML(s) {
  const E = D.earned(s);
  const rows = Object.keys(D.PAY).map(g => `<li><span><b>${esc(D.GAME_NAME[g])}</b><small>${esc(D.PAY_WORDS[g])}</small></span><em>${E.today[g] ? '+' + nf(E.today[g]) : '–'}</em></li>`).join('');
  return `<section class="dy-sec"><h2 class="dy-h">How you earn coins</h2><ul class="dy-earn">${rows}</ul>`
    + `<p class="dy-note">Each game’s first finished result of the day pays, from the day your Dynasty began. You’ve earned ${nf(E.total)} from ${E.days} game${E.days === 1 ? '' : 's'}. `
    + `Games against other squads, quick-selling cards and collections pay too.</p></section>`;
}
function storeHTML(st) {
  const s = D.mine(), bal = D.balance(s);
  return `<p class="dy-note">Every pack’s odds are posted. Cards you already have can be quick-sold for coins.</p><ul class="dy-store">`
    + D.PACK_ORDER.map(k => {
      const P = D.PACKS[k], can = bal >= P.price;
      return `<li class="dy-shop">${packHTML(k, {big: true})}<div class="dy-shop-t"><h3>${esc(P.name)}</h3><p>${esc(P.blurb)}</p>`
        + `<div class="dy-shop-b">${ui.button({label: nf(P.price), kind: can ? 'primary' : 'secondary', size: 's', disabled: !can, attrs: {'data-dy-buy': k}, cls: 'dy-buy'})}`
        + `<button type="button" class="dy-link" data-dy-odds="${k}">Odds</button></div></div></li>`;
    }).join('') + '</ul>';
}
function oddsSheet(kind) {
  const P = D.PACKS[kind];
  const pool = {live: 'Live Series', all: 'Live Series, Rookie, Gameday, Prime and Awards', gameday: 'a Gameday card (this week’s three times as likely)', elite: 'Legend 25%, Prime 30%, Award 20%, Gameday 25%, all 90+'};
  const body = D.packOdds(kind).map(g => `<section class="dy-odds"><h3>${g.n} card${g.n === 1 ? '' : 's'}: ${esc(pool[g.pool] || g.pool)}</h3>`
    + `<ul>${g.odds.map(o => `<li><span class="dy-dot is-${o.r}"></span>${esc(D.RARITY_NAME[o.r])}<b>${o.pct}%</b></li>`).join('')}</ul></section>`).join('')
    + '<p class="dy-note">Diamond 85+ · Gold 80–84 · Silver 75–79 · Bronze 65–74 · Common 64 and under.</p>';
  ui.openSheet({title: `${P.name} odds`, body, cls: 'dy-sheet', detents: ['fit']});
}

// Cards: filters, then a grid. Owned only by default; "Every card" shows the whole game (the ones you lack faded).
const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];
const PAGE = 60;
function cardsHTML(st) {
  const f = st.f;
  const seg = ui.seg({name: 'dy-cv', items: [{id: 'mine', label: 'My cards'}, {id: 'all', label: 'Every card'}, {id: 'cols', label: 'Collections'}], value: f.view, small: true});
  if (f.view === 'cols') return seg + colsHTML(st);
  const s = D.mine();
  const sp = D.spares(s);
  return seg
    + ui.chips({name: 'dy-ser', items: [{id: '', label: 'All series'}, ...D.SERIES_ORDER.map(k => ({id: k, label: D.SERIES[k].name}))], value: f.ser})
    + ui.chips({name: 'dy-pos', items: [{id: '', label: 'All positions'}, ...POS_ORDER.map(p => ({id: p, label: p}))], value: f.pos})
    + ui.chips({name: 'dy-rar', items: [{id: '', label: 'Any rarity'}, ...D.RARITY.slice().reverse().map(r => ({id: r, label: D.RARITY_NAME[r]}))], value: f.rar})
    + `<div class="dy-tools">${ui.searchField({name: 'dy-q', placeholder: 'Search players or teams', value: f.q})}</div>`
    + (sp.list.length && f.view === 'mine' ? `<button type="button" class="dy-spare" data-dy-spares>${ui.icon('bolt')}<span>Quick sell ${sp.list.reduce((t, x) => t + x.n, 0)} spare cop${sp.list.reduce((t, x) => t + x.n, 0) === 1 ? 'y' : 'ies'} for ${nf(sp.coins)}</span></button>` : '')
    + '<div class="dy-grid-w" data-dy-grid></div>';
}
function filtered(st) {
  const f = st.f, s = D.mine(), q = data.norm(f.q || '');
  return D.CARDS.filter(c => (f.view === 'all' || s.o[c.id] > 0) && (!f.ser || c.s === f.ser) && (!f.pos || c.pos === f.pos) && (!f.rar || c.r === f.rar)
    && (!q || data.norm(`${c.name} ${c.team} ${D.teamOf(c.team).name}`).includes(q)))
    .sort((a, b) => b.o - a.o || D.SERIES_ORDER.indexOf(a.s) - D.SERIES_ORDER.indexOf(b.s) || a.name.localeCompare(b.name));
}
function drawGrid(st, more = false) {
  const host = st.el.querySelector('[data-dy-grid]');
  if (!host) return;
  const list = filtered(st), s = D.mine();
  st.shown = more ? st.shown + PAGE : PAGE;
  const own = D.owned(s);
  const head = `<p class="dy-count">${st.f.view === 'all' ? `${nf(list.length)} card${list.length === 1 ? '' : 's'} · you have ${nf(own.have)} of ${nf(own.of)}` : `${nf(list.length)} card${list.length === 1 ? '' : 's'}`}</p>`;
  const cards = list.slice(0, st.shown).map(c => cardHTML(c, {size: 's', count: s.o[c.id] || 0, ghost: !(s.o[c.id] > 0), isNew: D.isNew(c.id, s)})).join('');
  host.innerHTML = list.length ? head + `<div class="dy-grid">${cards}</div>` + (list.length > st.shown ? ui.button({label: `Show more (${nf(list.length - st.shown)})`, kind: 'secondary', block: true, attrs: {'data-dy-more': ''}}) : '')
    : ui.empty({icon: 'search', title: st.f.view === 'mine' ? 'No cards like that yet' : 'No cards like that', body: st.f.view === 'mine' ? 'Open packs to fill your collection.' : 'Try another filter.'});
}
function colsHTML(st) {
  const s = D.mine(), groups = [['Series', c => c.kind === 'series'], ['Gameday weeks', c => c.kind === 'week'], ['Divisions and the league', c => c.kind === 'div' || c.kind === 'league'], ['Teams', c => c.kind === 'team']];
  const row = col => {
    const p = D.progress(col, s);
    const btn = p.claimed ? `<span class="dy-col-done">${ui.icon('check-circle')}Claimed</span>` : p.done ? ui.button({label: 'Claim', kind: 'primary', size: 's', attrs: {'data-dy-claim': col.id}}) : `<span class="dy-col-n">${p.have}/${p.of}</span>`;
    const lead = col.team ? `<img class="dy-col-logo" src="${esc(logoUrl(col.team, 64))}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="dy-col-ic">${ui.icon(col.kind === 'week' ? 'calendar' : col.kind === 'series' ? 'star' : 'crown')}</span>`;
    return `<li class="dy-col${p.done && !p.claimed ? ' is-ready' : ''}"><button type="button" class="dy-col-b" data-dy-col="${col.id}">${lead}<span class="dy-col-t"><b>${esc(col.name)}</b><small>${esc(D.rewardText(col.reward))}</small>`
      + `<i class="dy-bar"><b style="width:${Math.round(p.have / Math.max(1, p.of) * 100)}%"></b></i></span></button>${btn}</li>`;
  };
  return `<p class="dy-note">Collect a set to earn its reward, as in The Show: a team’s ten best Live cards, a division’s four teams, the whole league, and the special series.</p>`
    + groups.map(([t, f]) => `<section class="dy-sec"><h2 class="dy-h">${esc(t)}</h2><ul class="dy-cols">${D.COLLECTIONS.filter(f).map(row).join('')}</ul></section>`).join('');
}
function colSheet(st, id) {
  const col = D.collection(id), s = D.mine();
  if (!col) return;
  const p = D.progress(col, s);
  let body = `<p class="dy-note">Reward: <b>${esc(D.rewardText(col.reward))}</b>. ${p.claimed ? 'Claimed.' : p.done ? 'Complete: claim it!' : `${p.have} of ${p.of} so far.`}</p>`;
  if (col.need) {
    const need = col.need.map(D.card).filter(Boolean);
    body += `<p class="dy-note">${col.kind === 'series' || col.kind === 'week' ? `Any ${col.of} of these count.` : 'Every one of these.'}</p><div class="dy-grid">${need.map(c => cardHTML(c, {size: 's', ghost: !(s.o[c.id] > 0)})).join('')}</div>`;
  } else body += `<ul class="dy-cols">${col.sub.map(D.collection).filter(Boolean).map(c => `<li class="dy-col"><span class="dy-col-t"><b>${esc(c.name)}</b></span><span class="dy-col-n">${s.cl[c.id] ? ui.icon('check-circle') : `${D.progress(c, s).have}/${c.of}`}</span></li>`).join('')}</ul>`;
  if (col.reward.card) body += `<p class="dy-note">The reward card:</p><div class="dy-sheet-card is-s">${cardHTML(D.card(col.reward.card), {size: 'm', tag: false})}</div>`;
  if (p.done && !p.claimed) body += `<div class="dy-acts">${ui.button({label: 'Claim reward', kind: 'primary', block: true, attrs: {'data-dy-claim': id}})}</div>`;
  const sh = ui.openSheet({title: col.name, body, cls: 'dy-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const c = e.target.closest('[data-dy-card]');
    if (c) { cardSheet(st, c.dataset.dyCard); return; }
    if (e.target.closest('[data-dy-claim]')) { sh.close(); claimIt(st, id); }
  });
}
function claimIt(st, id) {
  const r = D.claim(id);
  if (!r.ok) return;
  ui.haptic('success');
  try { ui.confetti(st.el.getBoundingClientRect(), {colors: ['#7CF058', '#FFC531', '#7FD8FF', '#FFFFFF']}); } catch (_) {}
  ui.toast(`Claimed: ${D.rewardText(r.reward)}`, {icon: 'trophy', duration: 3200});
  refresh(st);
}

// Squad: the offense, the defense and the kicker, each slot its card (or an empty spot)
const SIDES = [['Offense', 'off'], ['Defense', 'def'], ['Special teams', 'st']];
function squadHTML(st) {
  const s = D.mine(), R = D.squadRating(s.sq), best = D.squadRating(D.bestSquad(s.o));
  const slot = sl => {
    const c = D.card(s.sq[sl.id]);
    return `<li class="dy-slot"><span class="dy-slot-l">${esc(sl.id)}</span>${c ? cardHTML(c, {size: 's', cls: 'in-slot', tag: false}) : `<span class="dy-empty">${esc(sl.pos)}</span>`}`
      + `<button type="button" class="dy-slot-b" data-dy-slot="${sl.id}" aria-label="${esc(`${sl.id}: ${c ? `${c.name}, ${c.o}` : 'empty'}. Change`)}"></button></li>`;
  };
  return `<div class="dy-sq-head"><span class="dy-ovr is-${D.rarityOf(R.ovr)}"><b>${R.ovr}</b><small>OVR</small></span>`
    + `<span class="dy-team-r"><button type="button" class="dy-name" data-dy-rename>${esc(D.teamName(s))} ${ui.icon('gear', {size: 14})}</button><span>Offense <b>${R.off}</b></span><span>Defense <b>${R.def}</b></span></span></div>`
    + (best.ovr > R.ovr ? `<button type="button" class="dy-ready" data-dy-auto>${ui.icon('bolt')}<span><b>Your best squad rates ${best.ovr}</b><small>Put your best cards in every slot</small></span>${ui.icon('chevron-right')}</button>` : '')
    + SIDES.map(([t, k]) => `<section class="dy-sec"><h2 class="dy-h">${t}</h2><ul class="dy-slots">${D.SLOTS.filter(x => x.side === k).map(slot).join('')}</ul></section>`).join('');
}
function slotSheet(st, slotId) {
  const s = D.mine(), sl = D.SLOT[slotId], cur = D.card(s.sq[slotId]);
  const list = Object.keys(s.o).map(D.card).filter(c => c && c.pos === sl.pos).sort((a, b) => b.o - a.o);
  const body = `<p class="dy-note">${esc(D.POS_NAME[sl.pos])}s in your collection${cur ? `. Now: ${esc(cur.name)}, ${cur.o}` : ''}.</p>`
    + (list.length ? `<div class="dy-grid">${list.map(c => cardHTML(c, {size: 's', cls: c.id === s.sq[slotId] ? 'is-on' : D.fits(s.sq, slotId, c.id) ? '' : 'is-off'})).join('')}</div>`
      : ui.empty({icon: 'person', title: `No ${sl.pos} cards yet`, body: 'Open packs to find one.'}))
    + (cur ? `<div class="dy-acts">${ui.button({label: 'Leave this spot empty', kind: 'secondary', block: true, attrs: {'data-dy-clear': ''}})}</div>` : '');
  const sh = ui.openSheet({title: `Pick your ${sl.id}`, body, cls: 'dy-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    if (e.target.closest('[data-dy-clear]')) { D.setSlot(slotId, null); sh.close(); refresh(st); return; }
    const b = e.target.closest('[data-dy-card]');
    if (!b) return;
    const id = b.dataset.dyCard;
    if (id === s.sq[slotId]) { sh.close(); return; }
    if (!D.fits(s.sq, slotId, id)) { ui.toast('He’s already in your squad at another spot.', {icon: 'info'}); return; }
    D.setSlot(slotId, id); ui.haptic('selection'); sh.close(); refresh(st);
  });
}
function renameSheet(st) {
  const s = D.mine();
  const body = `<label class="dy-field"><span>Team name</span><input type="text" maxlength="24" value="${esc(s.nm || D.teamName(s))}" data-dy-nm autocomplete="off"></label>`
    + `<div class="dy-acts">${ui.button({label: 'Save', kind: 'primary', block: true, attrs: {'data-dy-nm-save': ''}})}</div>`;
  const sh = ui.openSheet({title: 'Name your team', body, cls: 'dy-sheet', detents: ['fit']});
  sh.body.addEventListener('click', e => {
    if (!e.target.closest('[data-dy-nm-save]')) return;
    const v = sh.body.querySelector('[data-dy-nm]').value.trim().replace(/\s+/g, ' ').slice(0, 24);
    s.nm = v === D.teamName({nm: ''}) ? '' : v; D.touch(); sh.close(); refresh(st);
  });
}

// Play: the computer's three, the other squads, the board
function playHTML(st) {
  const s = D.mine(), G = D.todayGames(s), R = D.squadRating(s.sq);
  const res = r => (r ? `<span class="dy-res ${r.w ? 'is-w' : 'is-l'}">${r.w ? 'W' : 'L'} ${r.u}–${r.o}</span>` : '');
  let h = `<p class="dy-note">Your squad (${R.ovr} OVR) plays three computer teams a day and every other player’s squad once a day. Games are played out drive by drive from both squads’ ratings.</p>`;
  h += `<section class="dy-sec"><h2 class="dy-h">Today’s challenges</h2><ul class="dy-games">${D.CPU.map(L => {
    const T = D.cpuTeam(L.id), r = G.c[L.id];
    return `<li class="dy-game"><span class="dy-badge" style="--tp:${T.pri};--ts:${T.sec}">${esc(T.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase())}</span>`
      + `<span class="dy-game-t"><b>${esc(T.name)}</b><small>${T.ovr} OVR · win ${nf(L.win)}, lose ${nf(L.loss)}</small></span>`
      + (r ? res(r) : ui.button({label: 'Play', kind: 'primary', size: 's', attrs: {'data-dy-play': 'cpu:' + L.id}})) + '</li>';
  }).join('')}</ul></section>`;
  const opp = D.others();
  h += `<section class="dy-sec"><h2 class="dy-h">Head to head</h2>`;
  h += opp.length ? `<ul class="dy-games">${opp.map(o => {
    const r = G.h[o.key];
    return `<li class="dy-game">${o.member ? ui.avatar(o.member, {size: 36}) : ui.nickAvatar(o.name, {size: 36})}`
      + `<span class="dy-game-t"><b>${esc(o.team)}</b><small>${esc(o.name)}${o.guest ? ' (Guest)' : ''} · ${o.rating.ovr} OVR · win ${nf(D.H2H_PAY.win)}</small></span>`
      + (r ? res(r) : ui.button({label: 'Play', kind: 'primary', size: 's', attrs: {'data-dy-play': o.key}})) + '</li>';
  }).join('')}</ul>` : `<p class="dy-note">${daily.LB.ready ? 'No one else has a Dynasty yet. Their squads show up here once they do.' : 'Loading the other squads…'}</p>`;
  h += '</section>';
  h += boardHTML();
  return h;
}
function boardHTML() {
  const rows = D.others(undefined, {withMe: true});
  if (!rows.length) return '';
  return `<section class="dy-sec"><h2 class="dy-h">Dynasty board</h2><ol class="dy-board">${rows.map((r, i) => `<li class="${r.me ? 'is-me' : ''}"><span class="dy-rank">${i + 1}</span>`
    + `${r.member ? ui.avatar(r.member, {size: 30, you: r.me}) : ui.nickAvatar(r.name, {size: 30, you: r.me})}`
    + `<span class="dy-board-t"><b>${esc(r.me ? `${r.team} (you)` : r.team)}</b><small>${esc(r.name)}${r.guest ? ' · Guest' : ''} · ${nf(r.cards)} cards · ${r.cols} collection${r.cols === 1 ? '' : 's'} · ${r.rec.w}–${r.rec.l}</small></span>`
    + `<span class="dy-ovr is-s is-${D.rarityOf(r.rating.ovr)}"><b>${r.rating.ovr}</b></span></li>`).join('')}</ol></section>`;
}

// ---------------------------------------------------------------------------------------------------- opening a pack
function openPack(st, kind, team = null) {
  if (D.PACKS[kind].team && !team) { teamPicker(t => openPack(st, kind, t)); return; }
  const r = D.open(kind, {team});
  if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
  refresh(st);
  const cards = r.cards.map(D.card);
  // (best last, as The Show reveals)
  const order = cards.map((c, i) => ({c, i})).sort((a, b) => a.c.o - b.c.o).map(x => x.c);
  const ov = document.createElement('div');
  ov.className = 'dy-open';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Opening a ${D.PACKS[kind].name}`);
  ov.innerHTML = `<div class="dy-open-bg" style="--pc:${D.PACKS[kind].color}"></div>`
    + `<div class="dy-open-pack" data-dy-tear>${packHTML(kind, {big: true})}<p>Tap to open</p></div>`
    + `<div class="dy-open-cards" hidden>${order.map((c, i) => `<div class="dy-flip is-${c.r}${r.dup[c.id] ? ' is-dup' : ''}" data-i="${i}" style="--d:${i}"><div class="dy-flip-in">`
      + `<div class="dy-flip-back"><span>GD</span></div><div class="dy-flip-front">${cardHTML(c, {size: 'm', tag: false})}${r.dup[c.id] ? `<span class="dy-dup">Duplicate · ${nf(D.sellValue(c))}</span>` : '<span class="dy-dup is-new">New</span>'}</div></div></div>`).join('')}</div>`
    + `<div class="dy-open-bar" hidden>${ui.button({label: 'Reveal all', kind: 'secondary', attrs: {'data-dy-all': ''}})}${ui.button({label: 'Done', kind: 'primary', attrs: {'data-dy-done': ''}})}</div>`;
  document.body.appendChild(ov);
  const prevFocus = document.activeElement;
  requestAnimationFrame(() => ov.classList.add('is-in'));
  ov.querySelector('[data-dy-tear]').setAttribute('tabindex', '0');
  ov.querySelector('[data-dy-tear]').focus();
  let next = 0;
  const flip = el => {
    if (!el || el.classList.contains('is-up')) return;
    const c = order[Number(el.dataset.i)];
    el.classList.add('is-tell');
    setTimeout(() => {
      el.classList.add('is-up');
      if (c.r === 'diamond' || c.s !== 'L') {
        ui.haptic('success');
        if (c.r === 'diamond') { try { ui.confetti(el.getBoundingClientRect(), {colors: ['#7FD8FF', '#E9FBFF', '#B07CFF', '#FFFFFF'], count: 50}); } catch (_) {} }
      } else ui.haptic('light');
    }, RM() ? 0 : c.r === 'diamond' ? 650 : c.r === 'gold' ? 380 : 180);
  };
  const flipNext = () => {
    const els = [...ov.querySelectorAll('.dy-flip:not(.is-up):not(.is-tell)')];
    if (els.length) { flip(els[0]); next++; }
    if (els.length <= 1) ov.querySelector('[data-dy-all]').hidden = true;
  };
  const tear = () => {
    const p = ov.querySelector('.dy-open-pack');
    if (p.classList.contains('is-torn')) return;
    p.classList.add('is-torn'); ui.haptic('medium');
    setTimeout(() => { p.hidden = true; ov.querySelector('.dy-open-cards').hidden = false; ov.querySelector('.dy-open-bar').hidden = false; ov.querySelector('[data-dy-done]').focus(); }, RM() ? 0 : 520);
  };
  const close = () => {
    D.markSeen([]);
    ov.classList.remove('is-in'); ov.classList.add('is-out');
    setTimeout(() => ov.remove(), RM() ? 0 : 260);
    removeEventListener('keydown', onKey, true);
    try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (_) {}
    refresh(st);
  };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  addEventListener('keydown', onKey, true);
  ov.addEventListener('click', e => {
    if (e.target.closest('[data-dy-tear]')) { tear(); return; }
    if (e.target.closest('[data-dy-done]')) {
      // (a Done before everything's turned turns the rest first)
      const left = ov.querySelectorAll('.dy-flip:not(.is-up)');
      if (left.length) { left.forEach(el => el.classList.add('is-up', 'is-tell')); ov.querySelector('[data-dy-all]').hidden = true; return; }
      close(); return;
    }
    if (e.target.closest('[data-dy-all]')) { ov.querySelectorAll('.dy-flip:not(.is-up)').forEach((el, i) => setTimeout(() => flip(el), RM() ? 0 : i * 140)); e.target.closest('[data-dy-all]').hidden = true; return; }
    const f = e.target.closest('.dy-flip');
    if (f) { if (!f.classList.contains('is-up')) flip(f); return; }
    if (!ov.querySelector('.dy-open-cards').hidden) flipNext();
  });
  ov.querySelector('[data-dy-tear]').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tear(); } });
}
function teamPicker(done) {
  const teams = Object.values(D.TEAMS).sort((a, b) => a.name.localeCompare(b.name));
  const body = `<div class="dy-teams">${teams.map(t => `<button type="button" class="dy-teamb" data-dy-team="${t.abbr}" style="--tp:${t.pri}"><img src="${esc(logoUrl(t.abbr, 72))}" alt="" loading="lazy" onerror="this.remove()"><span>${esc(t.name)}</span></button>`).join('')}</div>`;
  const sh = ui.openSheet({title: 'Pick a team', body, cls: 'dy-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-dy-team]');
    if (b) { sh.close(); setTimeout(() => done(b.dataset.dyTeam), 280); }
  });
}

// ---------------------------------------------------------------------------------------------------- a game
function playOut(st, vs) {
  const r = D.play(vs);
  if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
  const s = D.mine(), g = r.game, me = D.teamName(s), R = D.squadRating(s.sq);
  const ov = document.createElement('div');
  ov.className = 'dy-open dy-gameov';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `${me} against ${r.opp.name}`);
  const oppR = D.squadRating(r.opp.sq);
  ov.innerHTML = `<div class="dy-open-bg" style="--pc:#1E3A8A"></div><div class="dy-sb">`
    + `<div class="dy-sb-t"><b>${esc(me)}</b><small>${R.ovr} OVR</small><span class="dy-sb-n" data-sa>0</span></div><span class="dy-sb-q" data-q>Q1</span>`
    + `<div class="dy-sb-t"><b>${esc(r.opp.name)}</b><small>${oppR.ovr} OVR</small><span class="dy-sb-n" data-sb>0</span></div></div>`
    + `<ol class="dy-pbp" aria-live="polite"></ol><div class="dy-final" hidden></div>`
    + `<div class="dy-open-bar">${ui.button({label: 'Skip to the final', kind: 'secondary', attrs: {'data-dy-skip': ''}})}${ui.button({label: 'Done', kind: 'primary', attrs: {'data-dy-done': ''}, cls: 'is-hide'})}</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('is-in'));
  const list = ov.querySelector('.dy-pbp'), sa = ov.querySelector('[data-sa]'), sb = ov.querySelector('[data-sb]'), qq = ov.querySelector('[data-q]');
  let i = 0, timer = 0;
  const step = () => {
    const p = g.plays[i++];
    if (!p) { final(); return; }
    qq.textContent = p.q > 4 ? 'OT' : 'Q' + p.q;
    sa.textContent = p.score[0]; sb.textContent = p.score[1];
    list.insertAdjacentHTML('afterbegin', `<li class="${p.side === 'a' ? 'is-me' : 'is-opp'}${p.n ? ' is-score' : ''}${p.big ? ' is-big' : ''}${p.quiet ? ' is-quiet' : ''}"><span>${p.q > 4 ? 'OT' : 'Q' + p.q}</span>${esc(p.text)}${p.n ? `<b>+${p.n}</b>` : ''}</li>`);
    if (p.n && p.side === 'a') ui.haptic('light');
    timer = setTimeout(step, RM() ? 120 : p.n ? 1000 : p.quiet ? 380 : 640);
  };
  const final = () => {
    clearTimeout(timer);
    sa.textContent = g.a; sb.textContent = g.b; qq.textContent = 'FINAL';
    const mvp = D.card(g.mvp);
    const f = ov.querySelector('.dy-final');
    f.hidden = false;
    f.innerHTML = `<h2 class="${r.won ? 'is-w' : 'is-l'}">${r.won ? 'You win!' : 'You lose'} ${g.a}–${g.b}</h2><p>${coin(r.coins)} earned</p>`
      + (mvp ? `<div class="dy-mvp"><span>Player of the game</span>${cardHTML(mvp, {size: 's', tag: false})}</div>` : '');
    ov.querySelector('[data-dy-skip]').hidden = true;
    ov.querySelector('[data-dy-done]').classList.remove('is-hide');
    if (r.won) { ui.haptic('success'); try { ui.confetti(f.getBoundingClientRect()); } catch (_) {} }
  };
  const close = () => { clearTimeout(timer); ov.classList.remove('is-in'); ov.classList.add('is-out'); setTimeout(() => ov.remove(), RM() ? 0 : 260); refresh(st); };
  ov.addEventListener('click', e => {
    if (e.target.closest('[data-dy-skip]')) { i = g.plays.length; g.plays.forEach((p, k) => { if (k >= list.children.length) list.insertAdjacentHTML('afterbegin', `<li class="${p.side === 'a' ? 'is-me' : 'is-opp'}${p.n ? ' is-score' : ''}"><span>${p.q > 4 ? 'OT' : 'Q' + p.q}</span>${esc(p.text)}${p.n ? `<b>+${p.n}</b>` : ''}</li>`); }); final(); return; }
    if (e.target.closest('[data-dy-done]')) close();
  });
  timer = setTimeout(step, RM() ? 0 : 700);
}

// ---------------------------------------------------------------------------------------------------- the screen
const PANES = {home: homeHTML, store: storeHTML, cards: cardsHTML, squad: squadHTML, play: playHTML};
function shellHTML() {
  return `<div class="dy" data-dy><div data-dy-wallet></div><div class="dy-tabs">${ui.seg({name: 'dy-tab', items: TABS, value: 'home'})}</div><div class="dy-pane" data-dy-pane></div></div>`;
}
function refresh(st) {
  if (st.dead) return;
  const el = st.el;
  // (the owner's alone, Oct 27 2026: a profile switched while it's open leaves it)
  if (!D.mayPlay()) { el.querySelector('[data-dy]').innerHTML = ''; if (!st.left) { st.left = true; st.ctx.back(); } return; }
  if (D.status !== 'ready') {
    el.querySelector('[data-dy-pane]').innerHTML = D.status === 'error' ? ui.empty({icon: 'info', title: 'The cards didn’t load', body: 'Check your connection.', action: {label: 'Try again', kind: 'primary', attrs: {'data-dy-retry': ''}}}) : ui.skeleton('rows', 4, {label: 'Loading the cards'});
    return;
  }
  const s = D.mine();
  el.querySelector('[data-dy-wallet]').innerHTML = walletHTML(s);
  const pane = el.querySelector('[data-dy-pane]');
  const keep = pane.querySelector('input[type=search]') === document.activeElement;
  if (keep && st.tab === 'cards') { drawGrid(st); return; }
  pane.innerHTML = PANES[st.tab](st);
  ui.hydrate(pane);
  if (st.tab === 'cards' && st.f.view !== 'cols') drawGrid(st);
}
function go(st, tab) {
  st.tab = tab;
  const segEl = st.el.querySelector('[data-seg="dy-tab"]');
  if (segEl) ui.setSeg(segEl, tab);
  refresh(st);
  st.ctx.screen.scrollTop = 0;
}

export default {
  id: 'dynasty',
  title: 'Dynasty',

  render() { return shellHTML(); },

  mount(el, ctx) {
    const st = {el, ctx, tab: 'home', f: {view: 'mine', ser: '', pos: '', rar: '', q: ''}, shown: PAGE, dead: false, stops: []};
    ST.set(ctx, st);
    ctx.setBackTitle('Dynasty');
    el.addEventListener('ui:change', e => {
      const {name, value} = e.detail || {};
      if (name === 'dy-tab') { st.tab = value; refresh(st); ctx.screen.scrollTop = 0; return; }
      if (name === 'dy-cv') { st.f.view = value; refresh(st); return; }
      if (name === 'dy-ser' || name === 'dy-pos' || name === 'dy-rar') { st.f[name.slice(3)] = value; drawGrid(st); }
    });
    el.addEventListener('input', e => {
      if (e.target.name === 'dy-q') { st.f.q = e.target.value; clearTimeout(st.qT); st.qT = setTimeout(() => drawGrid(st), 160); }
    });
    el.addEventListener('click', e => {
      const t = e.target;
      const q = sel => t.closest(sel);
      let b;
      if (q('[data-dy-retry]')) { D.load().then(() => refresh(st), () => refresh(st)); refresh(st); return; }
      if ((b = q('[data-dy-tab]'))) { go(st, b.dataset.dyTab); return; }
      if ((b = q('[data-dy-goto]'))) { st.f.view = 'cols'; go(st, 'cards'); return; }
      if (q('[data-dy-daily]')) {
        if (D.claimDaily()) { ui.haptic('success'); openPack(st, D.DAILY_PACK); }
        return;
      }
      if ((b = q('[data-dy-open]'))) { openPack(st, b.dataset.dyOpen); return; }
      if ((b = q('[data-dy-buy]'))) {
        const k = b.dataset.dyBuy, r = D.buy(k);
        if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
        ui.haptic('success');
        ui.toast(`${D.PACKS[k].name} bought`, {icon: 'check-circle', action: {label: 'Open it', fn: () => openPack(st, k)}});
        refresh(st); return;
      }
      if ((b = q('[data-dy-odds]'))) { oddsSheet(b.dataset.dyOdds); return; }
      if ((b = q('[data-dy-card]'))) { cardSheet(st, b.dataset.dyCard); return; }
      if (q('[data-dy-more]')) { drawGrid(st, true); return; }
      if (q('[data-dy-spares]')) {
        const sp = D.spares();
        ui.actionSheet({title: 'Quick sell your spares?', message: `Every copy beyond your first of ${sp.list.length} card${sp.list.length === 1 ? '' : 's'}, for ${nf(sp.coins)} coins. You keep one of each.`,
          actions: [{label: `Sell for ${nf(sp.coins)}`, role: 'destructive', value: 'sell'}]})
          .then(v => { if (v !== 'sell') return; const c = D.sellSpares(); ui.toast(`Sold for ${nf(c)} coins`, {icon: 'check-circle'}); refresh(st); });
        return;
      }
      if ((b = q('[data-dy-claim]'))) { claimIt(st, b.dataset.dyClaim); return; }
      if ((b = q('[data-dy-col]'))) { colSheet(st, b.dataset.dyCol); return; }
      if ((b = q('[data-dy-slot]'))) { slotSheet(st, b.dataset.dySlot); return; }
      if (q('[data-dy-auto]')) { D.autoSquad(); ui.haptic('success'); ui.toast('Your best squad is in', {icon: 'check-circle'}); refresh(st); return; }
      if (q('[data-dy-rename]')) { renameSheet(st); return; }
      if ((b = q('[data-dy-play]'))) { playOut(st, b.dataset.dyPlay); }
    });
    st.stops.push(D.subscribe(why => { if (why !== 'change' && why !== 'open' && why !== 'game') refresh(st); }));
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') { if (D.status === 'ready' && D.mayPlay()) { D.sync(); D.earned(D.mine(), true); } if (st.tab === 'play' || st.tab === 'home') refresh(st); } }));
    st.stops.push(data.subscribe(type => { if (type === 'me') refresh(st); }));
    st.stops.push(ctx.timer(() => { if (D.status === 'ready' && D.mayPlay() && st.tab === 'home') { const w = el.querySelector('[data-dy-wallet]'); if (w) w.innerHTML = walletHTML(D.mine()); } }, 15000));
    try { ui.lsSet('gg-dynasty-seen', '1'); } catch (_) {}
    D.load().then(() => refresh(st), () => refresh(st));
    D.loadGames().then(() => { if (D.status === 'ready' && D.mayPlay()) { D.earned(D.mine(), true); refresh(st); } });
    refresh(st);
  },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    st.stops.forEach(f => { try { f(); } catch (_) {} });
    D.flush();
    ST.delete(ctx);
  }
};
