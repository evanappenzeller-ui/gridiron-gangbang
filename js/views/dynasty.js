// Gridiron Dynasty's page (/puzzles/dynasty, pushed over Daily Games; core/dynasty.js has the game): five panes under
// a segmented control. Home (your coins, today's free pack, battles waiting on you, your unopened packs, collections to
// claim, your latest pulls and what the Daily Games paid), Store (the packs and their odds), Cards (your collection, every
// card in the game to look through, and the collections: The Show's), Deck (your 20-card battle deck) and Battle (your
// matches against other players, challenges, and the Dynasty board: everyone's, the scoreboards' rule, CLAUDE.md). A
// match itself plays on its own screen (views/dynasty-battle.js, /puzzles/dynasty/battle/<id>).
// A pack opens over everything (openPack): you rip it open with a swipe across its top (the owner's ask, Oct 28 2026:
// "ripping it open by swiping across", with "a subtle hint showing players how to do this": a finger gliding along the
// tear line till you start), the strip tearing along your finger and flying off once you're far enough across (short of
// it, it springs back; Enter rips it too); then its cards face down, each glowing its rarity's colour before it turns
// (The Show's tell), a Diamond with a burst; then the lot, new and duplicate marked.
// The cards themselves (cardHTML) are drawn in HTML: the rarity's frame, the team's colours, the photo (ESPN's headshot,
// else NFL.com's; a Legend his number), OVR, position, the series and the name; Coach and Stadium cards (trainerHTML)
// their own. battleHTML: a card's battle side (type, HP, Ability, attacks), on its close-up and in a battle.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-battle.js';
import * as MT from '../core/dynasty-match.js';

const esc = data.esc, nf = n => data.nf(n);
const ST = new WeakMap();
const TABS = [{id: 'home', label: 'Home'}, {id: 'store', label: 'Store'}, {id: 'cards', label: 'Cards'}, {id: 'deck', label: 'Deck'}, {id: 'battle', label: 'Battle'}];
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
// A Coach card's whistle and a Stadium's stands, drawn
const COACH_ART = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="38" r="14" fill="currentColor"/><rect x="24" y="24" width="30" height="12" rx="3" fill="currentColor"/><circle cx="24" cy="38" r="5" fill="rgba(0,0,0,.35)"/><path d="M50 24 58 14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
const STADIUM_ART = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 44c0-10 12-18 26-18s26 8 26 18v8H6z" fill="currentColor"/><path d="M14 44c0-6 8-11 18-11s18 5 18 11" fill="rgba(0,0,0,.35)"/><path d="M12 22v-8M52 22v-8M12 14l4 2-4 2M52 14l4 2-4 2" stroke="currentColor" stroke-width="2.5"/></svg>';
/** A Coach or Stadium card (t: core/dynasty.js trainer()). o: as cardHTML's. */
export function trainerHTML(t, o = {}) {
  if (!t) return '';
  const T = t.team ? D.teamOf(t.team) : null, coach = t.kind === 'coach';
  const label = `${t.name}, ${coach ? 'Coach card' : 'Stadium card'}, ${D.RARITY_NAME[t.r]}. ${t.text}${o.count > 1 ? `, ${o.count} copies` : ''}${o.ghost ? ', not in your collection' : ''}`;
  const inner = `<span class="dy-c-frame" aria-hidden="true"></span><span class="dy-t-art" aria-hidden="true">${coach ? COACH_ART : STADIUM_ART}`
    + `${T ? `<img class="dy-t-logo" src="${esc(logoUrl(t.team, 80))}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : ''}</span>`
    + `<span class="dy-c-ser" aria-hidden="true">${coach ? 'COACH' : 'STADIUM'}</span>`
    + `<span class="dy-t-name" aria-hidden="true"><b>${esc(t.name)}</b><small>${esc(t.text)}</small></span>`
    + (o.isNew ? '<span class="dy-c-new" aria-hidden="true">NEW</span>' : '')
    + (o.count > 1 ? `<span class="dy-c-cnt" aria-hidden="true">×${o.count}</span>` : '')
    + '<span class="dy-c-shine" aria-hidden="true"></span>';
  const cls = `dy-card dy-trainer is-${t.r} k-${t.kind} sz-${o.size || 'm'}${o.ghost ? ' is-ghost' : ''}${o.cls ? ' ' + o.cls : ''}`;
  const style = T ? `--tp:${T.pri};--ts:${T.sec}` : '--tp:#24304F;--ts:#C9A227';
  return o.tag === false ? `<div class="${cls}" style="${style}" role="img" aria-label="${esc(label)}">${inner}</div>`
    : `<button type="button" class="${cls}" style="${style}" data-dy-card="${esc(t.id)}" aria-label="${esc(label)}">${inner}</button>`;
}
/** Any card by id: a player's or a Coach or Stadium card. */
export const anyHTML = (id, o = {}) => (D.card(id) ? cardHTML(D.card(id), o) : trainerHTML(D.trainer(id), o));
/** An energy pip. */
export const pipHTML = e => `<i class="db-e e-${e === '*' ? 'any' : e}" title="${esc(B.ENERGY[e])}"><span class="sr-only">${esc(B.ENERGY[e])}</span></i>`;
/** A card's battle side: type, HP, weakness and retreat, its Ability, its attacks. */
export function battleHTML(id) {
  const t = D.trainer(id);
  if (t) return `<div class="db-info"><p class="db-info-k">${t.kind === 'coach' ? 'Coach card · one a turn' : 'Stadium · in play for both sides till another replaces it'}</p><p>${esc(t.text)}</p></div>`;
  const st = B.stats(id), c = D.card(id);
  if (!st) return '';
  const T = B.TYPES[st.type];
  const ab = st.ability ? `<div class="db-ab"><b>Ability · ${esc(B.ABILITY[st.ability].name)}</b><span>${esc(B.ABILITY[st.ability].text)}</span></div>` : '';
  const atk = st.attacks.map(a => `<li><span class="db-cost">${a.cost.map(pipHTML).join('')}</span><span class="db-an"><b>${esc(a.name)}</b>`
    + `${B.fxText(a) ? `<small>${esc(B.fxText(a))}</small>` : ''}${a.note ? `<small>${esc(a.note)}</small>` : ''}${a.flat ? '<small>Ignores weakness.</small>' : ''}</span><em>${a.dmg}</em></li>`).join('');
  const stage = st.stage ? `Evolves from ${esc(c.name)}’s Basic card` : 'Basic';
  return `<div class="db-info"><div class="db-info-h"><span class="db-type" style="--ty:${T.color}">${esc(T.name)}</span><span>${stage}${st.ex ? ' · worth 2 touchdowns' : ''}</span><b>${st.hp} HP</b></div>`
    + ab + `<ul class="db-atk">${atk}</ul>`
    + `<p class="db-foot">Weak to ${st.weak ? `${esc(B.TYPES[st.weak].name)} (+${B.WEAK_BONUS})` : 'nothing'} · Switch out: ${st.retreat ? `${st.retreat} energy` : 'free'}</p></div>`;
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
/** A card up close: the card, its battle side, its back, and what you can do with it. */
function cardSheet(st, id) {
  const c = D.anyCard(id);
  if (!c) return;
  const s = D.mine(), n = s.o[id] || 0, inDeck = s.dk.filter(x => x === id).length;
  D.markSeen([id]);
  const sellN = n - Math.max(inDeck, 0);
  const acts = [];
  if (sellN > 0) acts.push(ui.button({label: `Quick sell for ${nf(D.sellValue(c))}`, kind: 'secondary', block: true, attrs: {'data-dy-sell': id}}));
  if (n > inDeck && s.dk.length < B.DECK_SIZE) acts.push(ui.button({label: 'Add to my deck', kind: 'primary', block: true, attrs: {'data-dy-add': id}}));
  if (inDeck) acts.push(ui.button({label: 'Take out of my deck', kind: 'secondary', block: true, attrs: {'data-dy-rm': id}}));
  const body = `<div class="dy-sheet-card">${anyHTML(id, {size: 'l', tag: false, ghost: !n})}</div>`
    + `<p class="dy-own">${n ? `In your collection${n > 1 ? ` · ${n} copies` : ''}${inDeck ? ` · ${inDeck} in your deck` : ''}` : 'Not in your collection yet'}</p>`
    + battleHTML(id) + (D.card(id) ? backHTML(c) : '') + (acts.length ? `<div class="dy-acts">${acts.join('')}</div>` : '');
  const sh = ui.openSheet({title: c.name, body, cls: 'dy-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    if (e.target.closest('[data-dy-sell]')) {
      const r = D.sell(id, 1);
      if (r.ok) { ui.haptic('success'); ui.toast(`Sold for ${nf(r.coins)} coins`, {icon: 'check-circle'}); sh.close(); refresh(st); }
      return;
    }
    if (e.target.closest('[data-dy-add]')) { deckAdd(st, id); sh.close(); return; }
    if (e.target.closest('[data-dy-rm]')) { deckRemove(st, id); sh.close(); }
  });
}
function deckAdd(st, id) {
  const s = D.mine(), ids = s.dk.concat(id);
  const stt = B.stats(id), k = stt ? 'p:' + stt.from : id;
  const same = s.dk.filter(x => (B.stats(x) ? 'p:' + B.stats(x).from : x) === k).length;
  if (s.dk.length >= B.DECK_SIZE) { ui.toast('Your deck is full (20). Take a card out first.', {icon: 'info'}); return false; }
  if (same >= B.MAX_COPIES) { ui.toast(`At most ${B.MAX_COPIES} of any player or card.`, {icon: 'info'}); return false; }
  if (s.dk.filter(x => x === id).length >= (s.o[id] || 0)) { ui.toast('You don’t have another copy.', {icon: 'info'}); return false; }
  D.setDeck(ids); ui.haptic('selection'); refresh(st); return true;
}
function deckRemove(st, id) {
  const s = D.mine(), i = s.dk.indexOf(id);
  if (i < 0) return;
  const ids = s.dk.slice(); ids.splice(i, 1); D.setDeck(ids); ui.haptic('selection'); refresh(st);
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
  const s = D.mine(), packs = D.PACK_ORDER.filter(k => s.pk[k] > 0), ready = D.claimable(s), wait = MT.waiting(), dk = D.deckOf(s);
  const daily = D.dailyReady(s);
  let h = '';
  if (daily) h += `<button type="button" class="dy-daily" data-dy-daily>${packHTML(D.DAILY_PACK)}<span><b>Your free pack is here</b><small>A Standard Pack every day. Tap to take it.</small></span>${ui.icon('chevron-right')}</button>`;
  if (wait) h += `<button type="button" class="dy-daily is-battle" data-dy-tab="battle">${ui.icon('versus', {size: 28})}<span><b>${wait === 1 ? 'A battle is' : `${wait} battles are`} waiting on you</b><small>Your move. Tap to play.</small></span>${ui.icon('chevron-right')}</button>`;
  if (ready.length) h += `<button type="button" class="dy-ready" data-dy-goto="cols">${ui.icon('trophy')}<span><b>${ready.length === 1 ? 'A collection is' : `${ready.length} collections are`} complete</b><small>Claim ${esc(D.rewardText(ready[0].reward))}${ready.length > 1 ? ' and more' : ''}</small></span>${ui.icon('chevron-right')}</button>`;
  h += `<section class="dy-sec"><h2 class="dy-h">Your packs</h2>`;
  h += packs.length ? `<div class="dy-packs" data-hscroll>${packs.map(k => `<button type="button" class="dy-packb" data-dy-open="${k}">${packHTML(k, {count: s.pk[k]})}<span>${esc(D.PACKS[k].name)}</span><b>Open</b></button>`).join('')}</div>`
    : `<p class="dy-note">No packs to open. Get one in the Store${daily ? ', or take today’s free one' : ''}.</p>${ui.button({label: 'Go to the Store', kind: 'secondary', size: 's', attrs: {'data-dy-tab': 'store'}})}`;
  h += '</section>';
  h += `<section class="dy-sec"><h2 class="dy-h">${esc(D.teamName(s))}</h2><button type="button" class="dy-team" data-dy-tab="deck">`
    + `<span class="dy-ovr is-trophy"><b>${nf(s.tr)}</b><small>TROPHIES</small></span>`
    + `<span class="dy-team-r"><span>Deck <b>${dk.ids.length}/${B.DECK_SIZE}</b>${dk.ok ? ` ${dk.types.map(pipHTML).join('')}` : ''}</span><span>Record <b>${s.rec.w}–${s.rec.l}${s.rec.d ? `–${s.rec.d}` : ''}</b></span>`
    + `${dk.ok ? '' : `<span class="dy-warn">${esc(dk.why)}</span>`}</span>${ui.icon('chevron-right')}</button></section>`;
  const lp = s.lp.filter(D.isCard).slice(0, 12);
  if (lp.length) h += `<section class="dy-sec"><h2 class="dy-h">Latest pulls</h2><div class="dy-rail" data-hscroll>${lp.map(id => anyHTML(id, {size: 's', isNew: D.isNew(id, s)})).join('')}</div></section>`;
  h += earnHTML(s);
  return h;
}
function earnHTML(s) {
  const E = D.earned(s);
  const rows = Object.keys(D.PAY).map(g => `<li><span><b>${esc(D.GAME_NAME[g])}</b><small>${esc(D.PAY_WORDS[g])}</small></span><em>${E.today[g] ? '+' + nf(E.today[g]) : '–'}</em></li>`).join('');
  return `<section class="dy-sec"><h2 class="dy-h">How you earn coins</h2><ul class="dy-earn">${rows}</ul>`
    + `<p class="dy-note">Each game’s first finished result of the day pays, from the day your Dynasty began. You’ve earned ${nf(E.total)} from ${E.days} game${E.days === 1 ? '' : 's'}. `
    + `Battles (a win ${nf(D.BATTLE_PAY.w.coins)}, a loss ${nf(D.BATTLE_PAY.l.coins)}), quick-selling cards and collections pay too.</p></section>`;
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
  const pool = {live: 'Live Series', trainer: 'a Coach or Stadium card', all: 'Live Series, Rookie, Gameday, Prime and Awards', gameday: 'a Gameday card (this week’s three times as likely)', elite: 'Legend 25%, Prime 30%, Award 20%, Gameday 25%, all 90+'};
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
    + ui.chips({name: 'dy-ser', items: [{id: '', label: 'All series'}, ...D.SERIES_ORDER.map(k => ({id: k, label: D.SERIES[k].name})), {id: 'T', label: 'Coach & Stadium'}], value: f.ser})
    + ui.chips({name: 'dy-pos', items: [{id: '', label: 'All positions'}, ...POS_ORDER.map(p => ({id: p, label: p}))], value: f.pos})
    + ui.chips({name: 'dy-rar', items: [{id: '', label: 'Any rarity'}, ...D.RARITY.slice().reverse().map(r => ({id: r, label: D.RARITY_NAME[r]}))], value: f.rar})
    + `<div class="dy-tools">${ui.searchField({name: 'dy-q', placeholder: 'Search players or teams', value: f.q})}</div>`
    + (sp.list.length && f.view === 'mine' ? `<button type="button" class="dy-spare" data-dy-spares>${ui.icon('bolt')}<span>Quick sell ${sp.list.reduce((t, x) => t + x.n, 0)} spare cop${sp.list.reduce((t, x) => t + x.n, 0) === 1 ? 'y' : 'ies'} for ${nf(sp.coins)}</span></button>` : '')
    + '<div class="dy-grid-w" data-dy-grid></div>';
}
function filtered(st) {
  const f = st.f, s = D.mine(), q = data.norm(f.q || '');
  const tr = !f.pos && (!f.ser || f.ser === 'T') ? D.TRAINER_IDS.map(D.trainer).filter(t => (f.view === 'all' || s.o[t.id] > 0) && (!f.rar || t.r === f.rar)
    && (!q || data.norm(`${t.name} ${t.text}`).includes(q))) : [];
  if (f.ser === 'T') return tr;
  return D.CARDS.filter(c => (f.view === 'all' || s.o[c.id] > 0) && (!f.ser || c.s === f.ser) && (!f.pos || c.pos === f.pos) && (!f.rar || c.r === f.rar)
    && (!q || data.norm(`${c.name} ${c.team} ${D.teamOf(c.team).name}`).includes(q)))
    .sort((a, b) => b.o - a.o || D.SERIES_ORDER.indexOf(a.s) - D.SERIES_ORDER.indexOf(b.s) || a.name.localeCompare(b.name)).concat(tr);
}
function drawGrid(st, more = false) {
  const host = st.el.querySelector('[data-dy-grid]');
  if (!host) return;
  const list = filtered(st), s = D.mine();
  st.shown = more ? st.shown + PAGE : PAGE;
  const own = D.owned(s);
  const head = `<p class="dy-count">${st.f.view === 'all' ? `${nf(list.length)} card${list.length === 1 ? '' : 's'} · you have ${nf(own.have)} of ${nf(own.of)}` : `${nf(list.length)} card${list.length === 1 ? '' : 's'}`}</p>`;
  const cards = list.slice(0, st.shown).map(c => anyHTML(c.id, {size: 's', count: s.o[c.id] || 0, ghost: !(s.o[c.id] > 0), isNew: D.isNew(c.id, s)})).join('');
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
    const need = col.need.filter(D.isCard);
    body += `<p class="dy-note">${(col.kind === 'series' || col.kind === 'week') && col.of < need.length ? `Any ${col.of} of these count.` : 'Every one of these.'}</p><div class="dy-grid">${need.map(id => anyHTML(id, {size: 's', ghost: !(s.o[id] > 0)})).join('')}</div>`;
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

// Deck: your 20 battle cards, what makes a deck legal, and the cards to add
function deckHTML(st) {
  const s = D.mine(), dk = D.deckOf(s);
  const groups = [['Players', id => !!D.card(id)], ['Coach cards', id => D.trainer(id) && D.trainer(id).kind === 'coach'], ['Stadiums', id => D.trainer(id) && D.trainer(id).kind === 'stadium']];
  const counts = {};
  dk.ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const uniq = Object.keys(counts).sort((a, b) => (D.card(b) ? D.card(b).o : 0) - (D.card(a) ? D.card(a).o : 0));
  let h = `<div class="dy-sq-head"><span class="dy-ovr${dk.ok ? ' is-ok' : ' is-bad'}"><b>${dk.ids.length}</b><small>OF ${B.DECK_SIZE}</small></span>`
    + `<span class="dy-team-r"><button type="button" class="dy-name" data-dy-rename>${esc(D.teamName(s))} ${ui.icon('gear', {size: 14})}</button>`
    + `<span>Energy <b>${dk.types.map(pipHTML).join(' ')}</b> ${esc(dk.types.map(e => B.ENERGY[e]).join(' · '))}</span>`
    + `<span class="${dk.ok ? 'dy-okay' : 'dy-warn'}">${dk.ok ? 'Ready to battle' : esc(dk.why)}</span></span></div>`;
  h += `<div class="dy-deck-b">${ui.button({label: 'Add cards', kind: 'primary', size: 's', icon: 'plus', attrs: {'data-dy-addsheet': ''}})}`
    + `${ui.button({label: 'Build my best deck', kind: 'secondary', size: 's', icon: 'bolt', attrs: {'data-dy-autodeck': ''}})}</div>`;
  h += `<p class="dy-note">Pokémon TCG Pocket’s rules: 20 cards, at most 2 of any player or card, and at least one Basic player. Your players’ types make your energy: one or two types work best. Tap a card to see it or take it out.</p>`;
  groups.forEach(([t, f]) => {
    const ids = uniq.filter(f);
    if (ids.length) h += `<section class="dy-sec"><h2 class="dy-h">${esc(t)} · ${ids.reduce((n, id) => n + counts[id], 0)}</h2><div class="dy-grid">${ids.map(id => anyHTML(id, {size: 's', count: counts[id], cls: 'in-deck'})).join('')}</div></section>`;
  });
  return h;
}
function addSheet(st) {
  const s = D.mine();
  const draw = kind => {
    const inDeck = id => s.dk.filter(x => x === id).length;
    const ids = Object.keys(s.o).filter(id => D.isCard(id) && s.o[id] > inDeck(id))
      .filter(id => kind === 'all' || (kind === 'players' ? !!D.card(id) : !!D.trainer(id)))
      .sort((a, b) => (D.card(b) ? D.card(b).o : 0) - (D.card(a) ? D.card(a).o : 0));
    return `<p class="dy-note">${s.dk.length} of ${B.DECK_SIZE} in your deck. Tap a card to add it.</p>`
      + (ids.length ? `<div class="dy-grid">${ids.map(id => anyHTML(id, {size: 's', count: s.o[id] - inDeck(id)})).join('')}</div>` : ui.empty({icon: 'search', title: 'Nothing more to add', body: 'Open packs for more cards.'}));
  };
  let kind = 'players';
  const body = ui.seg({name: 'dy-addk', items: [{id: 'players', label: 'Players'}, {id: 'trainers', label: 'Coach & Stadium'}], value: kind, small: true}) + `<div data-dy-addlist>${draw(kind)}</div>`;
  const sh = ui.openSheet({title: 'Add to your deck', body, cls: 'dy-sheet', detents: ['large']});
  sh.body.addEventListener('ui:change', e => { if (e.detail && e.detail.name === 'dy-addk') { kind = e.detail.value; sh.body.querySelector('[data-dy-addlist]').innerHTML = draw(kind); } });
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-dy-card]');
    if (!b) return;
    if (deckAdd(st, b.dataset.dyCard)) {
      ui.toast(`${D.anyCard(b.dataset.dyCard).name} added (${D.mine().dk.length}/${B.DECK_SIZE})`, {icon: 'check-circle', duration: 1200});
      sh.body.querySelector('[data-dy-addlist]').innerHTML = draw(kind);
      if (D.mine().dk.length >= B.DECK_SIZE) sh.close();
    }
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

// Battle: your matches (what's yours to do first), challenges sent and finished games, everyone to challenge, the board
const ago = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const avatarOf = (o, size = 36) => (o.member ? ui.avatar(o.member, {size}) : ui.nickAvatar(o.name, {size}));
function battleHTML2(st) {
  const s = D.mine(), dk = D.deckOf(s), all = MT.list();
  const row = (x, sub, btns) => `<li class="dy-game">${avatarOf(x.opp)}<span class="dy-game-t"><b>${esc(x.opp.name)}${x.opp.guest ? ' <i class="dy-tag">Guest</i>' : ''}</b><small>${sub}</small></span>${btns}</li>`;
  const score = x => (x.G ? `${x.G.p[x.you].pts}–${x.G.p[1 - x.you].pts}` : '');
  const sec = (title, items, f) => (items.length ? `<section class="dy-sec"><h2 class="dy-h">${title}</h2><ul class="dy-games">${items.map(f).join('')}</ul></section>` : '');
  let h = '';
  if (!dk.ok) h += `<button type="button" class="dy-ready" data-dy-tab="deck">${ui.icon('info')}<span><b>Your deck isn’t ready</b><small>${esc(dk.why)}</small></span>${ui.icon('chevron-right')}</button>`;
  h += sec('Your move', all.filter(x => ['invite', 'setup', 'yours'].includes(x.state)), x => x.state === 'invite'
    ? row(x, 'Challenged you to a battle', `<span class="dy-btns">${ui.button({label: 'Accept', kind: 'primary', size: 's', attrs: {'data-dy-accept': x.mid}, disabled: !dk.ok})}${ui.button({label: 'Decline', kind: 'plain', size: 's', attrs: {'data-dy-decline': x.mid}})}</span>`)
    : row(x, x.state === 'setup' ? 'Pick your starting lineup' : `Your turn · ${score(x)}`, ui.button({label: 'Play', kind: 'primary', size: 's', attrs: {'data-dy-go': x.mid}})));
  h += sec('Their move', all.filter(x => x.state === 'theirs'), x => row(x, `Waiting ${ago(x.idle)} · ${score(x) || 'setting up'}`,
    x.idle >= MT.IDLE_MS ? ui.button({label: 'Claim win', kind: 'secondary', size: 's', attrs: {'data-dy-claimwin': x.mid}}) : ui.button({label: 'View', kind: 'secondary', size: 's', attrs: {'data-dy-go': x.mid}})));
  h += sec('Challenges sent', all.filter(x => x.state === 'sent'), x => row(x, 'Waiting for them to accept', ui.button({label: 'Cancel', kind: 'plain', size: 's', attrs: {'data-dy-cancel': x.mid}})));
  const busy = new Set(all.filter(x => !['over', 'closed'].includes(x.state)).map(x => x.opp.key));
  const opp = D.others();
  h += `<section class="dy-sec"><h2 class="dy-h">Challenge someone</h2>`;
  h += opp.length ? `<ul class="dy-games">${opp.map(o => `<li class="dy-game">${avatarOf(o)}<span class="dy-game-t"><b>${esc(o.name)}${o.guest ? ' <i class="dy-tag">Guest</i>' : ''}</b>`
    + `<small>${esc(o.team)} · ${nf(o.tr)} trophies · ${o.rec.w}–${o.rec.l}</small></span>`
    + (busy.has(o.key) ? '<span class="dy-res">In a match</span>' : ui.button({label: 'Challenge', kind: 'primary', size: 's', attrs: {'data-dy-challenge': o.key}, disabled: !dk.ok})) + '</li>').join('')}</ul>`
    : `<p class="dy-note">${daily.LB.ready ? 'Your opponent hasn’t opened Gridiron Dynasty yet. Once they do, you can challenge them here.' : 'Loading the other players…'}</p>`;
  h += '</section>';
  h += sec('Finished', all.filter(x => x.state === 'over').slice(0, 10), x => row(x, `${{points: 'Three touchdowns', empty: 'No players left', time: 'Turn limit', resign: 'Resigned', claim: 'Left it 72 hours'}[x.why] || ''} · ${score(x)}`,
    `<button type="button" class="dy-res ${x.result === 'w' ? 'is-w' : x.result === 'l' ? 'is-l' : ''}" data-dy-go="${x.mid}">${x.result === 'w' ? 'Won' : x.result === 'l' ? 'Lost' : 'Draw'}</button>`));
  h += boardHTML();
  h += `<p class="dy-note">Battles are Pokémon TCG Pocket’s rules with your cards: knock out three of their players (a Legend or Prime counts two) to win. You play when you like; they get a notice on their Dynasty case when it’s their move. A win pays ${nf(D.BATTLE_PAY.w.coins)} coins and ${D.BATTLE_PAY.w.tr} trophies.</p>`;
  return h;
}
function boardHTML() {
  const rows = D.others(undefined, {withMe: true});
  if (!rows.length) return '';
  return `<section class="dy-sec"><h2 class="dy-h">Dynasty board</h2><ol class="dy-board">${rows.map((r, i) => `<li class="${r.me ? 'is-me' : ''}"><span class="dy-rank">${i + 1}</span>`
    + `${r.member ? ui.avatar(r.member, {size: 30, you: r.me}) : ui.nickAvatar(r.name, {size: 30, you: r.me})}`
    + `<span class="dy-board-t"><b>${esc(r.me ? `${r.team} (you)` : r.team)}</b><small>${esc(r.name)}${r.guest ? ' · Guest' : ''} · ${r.rec.w}–${r.rec.l} · ${nf(r.cards)} cards · ${r.cols} collection${r.cols === 1 ? '' : 's'}</small></span>`
    + `<span class="dy-tro"><b>${nf(r.tr)}</b><small>🏆</small></span></li>`).join('')}</ol></section>`;
}

// ---------------------------------------------------------------------------------------------------- opening a pack
function openPack(st, kind, team = null) {
  if (D.PACKS[kind].team && !team) { teamPicker(t => openPack(st, kind, t)); return; }
  const r = D.open(kind, {team});
  if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
  refresh(st);
  const cards = r.cards.map(D.anyCard);
  // (best last, as The Show reveals; a Coach or Stadium card first)
  const order = cards.map((c, i) => ({c, i})).sort((a, b) => (a.c.o || 0) - (b.c.o || 0)).map(x => x.c);
  const ov = document.createElement('div');
  ov.className = 'dy-open';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Opening a ${D.PACKS[kind].name}`);
  ov.innerHTML = `<div class="dy-open-bg" style="--pc:${D.PACKS[kind].color}"></div>`
    + `<div class="dy-open-pack" data-dy-tear tabindex="0" role="button" aria-label="Rip the pack open: swipe across its top, or press Enter">`
    + `<div class="dy-rip" style="--p:0;--dir:1"><div class="dy-rip-body" style="clip-path:${TEAR.body}">${packHTML(kind, {big: true})}</div>`
    + `<div class="dy-rip-top" style="clip-path:${TEAR.top}">${packHTML(kind, {big: true})}</div>`
    + `<span class="dy-rip-line" aria-hidden="true"></span><span class="dy-rip-hint" aria-hidden="true"><i class="dy-rip-trail"></i><i class="dy-rip-finger"></i></span></div>`
    + `<p class="dy-rip-say">Swipe across the top to rip it open</p></div>`
    + `<div class="dy-open-cards" hidden>${order.map((c, i) => `<div class="dy-flip is-${c.r}${r.dup[c.id] ? ' is-dup' : ''}" data-i="${i}" style="--d:${i}"><div class="dy-flip-in">`
      + `<div class="dy-flip-back"><span>GD</span></div><div class="dy-flip-front">${anyHTML(c.id, {size: 'm', tag: false})}${r.dup[c.id] ? `<span class="dy-dup">Duplicate · ${nf(D.sellValue(c))}</span>` : '<span class="dy-dup is-new">New</span>'}</div></div></div>`).join('')}</div>`
    + `<div class="dy-open-bar" hidden>${ui.button({label: 'Reveal all', kind: 'secondary', attrs: {'data-dy-all': ''}})}${ui.button({label: 'Done', kind: 'primary', attrs: {'data-dy-done': ''}})}</div>`;
  document.body.appendChild(ov);
  const prevFocus = document.activeElement;
  requestAnimationFrame(() => ov.classList.add('is-in'));
  ov.querySelector('[data-dy-tear]').focus();
  let next = 0;
  const flip = el => {
    if (!el || el.classList.contains('is-up')) return;
    const c = order[Number(el.dataset.i)];
    el.classList.add('is-tell');
    setTimeout(() => {
      el.classList.add('is-up');
      if (c.r === 'diamond' || (c.s && c.s !== 'L')) {
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
  // ---- the rip: drag across the pack's top; the strip tears along the finger (--p, 0..1, from the side you started)
  const pk = ov.querySelector('.dy-open-pack'), rip = pk.querySelector('.dy-rip');
  let drag = null, prog = 0, dir = 1, anim = 0, ripped = false;
  const set = v => {
    prog = Math.max(0, Math.min(1, v));
    rip.style.setProperty('--p', prog.toFixed(3)); rip.style.setProperty('--dir', String(dir));
  };
  const tween = (to, ms, then) => {
    cancelAnimationFrame(anim);
    const from = prog, t0 = performance.now();
    if (RM() || ms <= 0) { set(to); if (then) then(); return; }
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      set(from + (to - from) * e);
      if (k < 1) anim = requestAnimationFrame(step); else if (then) then();
    };
    anim = requestAnimationFrame(step);
  };
  const tear = () => {
    if (ripped) return;
    ripped = true; drag = null;
    pk.classList.remove('is-drag'); pk.classList.add('is-touched');
    tween(1, 110, () => {
      pk.classList.add('is-torn'); ui.haptic('medium');
      setTimeout(() => { pk.hidden = true; ov.querySelector('.dy-open-cards').hidden = false; ov.querySelector('.dy-open-bar').hidden = false; ov.querySelector('[data-dy-done]').focus(); }, RM() ? 0 : 560);
    });
  };
  // (a tap with no swipe: the hint shows itself plainly, and the pack shivers)
  let nudgeT = 0;
  const nudge = () => {
    pk.classList.remove('is-nudge'); void pk.offsetWidth; pk.classList.add('is-nudge');
    clearTimeout(nudgeT); nudgeT = setTimeout(() => pk.classList.remove('is-nudge'), 1600);
    ui.haptic('light');
  };
  pk.addEventListener('pointerdown', e => {
    if (ripped || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cancelAnimationFrame(anim);
    const r = rip.getBoundingClientRect();
    drag = {x: e.clientX, w: r.width, moved: false, lx: e.clientX, lt: performance.now(), v: 0, tick: 0, start: prog};
    try { pk.setPointerCapture(e.pointerId); } catch (_) {}
    clearTimeout(nudgeT); pk.classList.remove('is-nudge'); pk.classList.add('is-drag');
  });
  pk.addEventListener('pointermove', e => {
    if (!drag || ripped) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true; dir = dx > 0 ? 1 : -1; pk.classList.add('is-touched');
    }
    const now = performance.now();
    drag.v = (e.clientX - drag.lx) * dir / Math.max(1, now - drag.lt); drag.lx = e.clientX; drag.lt = now;
    set(dx * dir / (drag.w * 0.85));
    const tick = Math.floor(prog * 4);
    if (tick > drag.tick) { drag.tick = tick; ui.haptic('selection'); }
    if (prog >= 1) tear();
  });
  const let_go = () => {
    if (!drag || ripped) return;
    const d = drag;
    drag = null; pk.classList.remove('is-drag');
    if (!d.moved) { nudge(); return; }
    // (far enough across, or a quick flick past a quarter: it rips; short of it, the strip springs back)
    if (prog >= 0.55 || (prog >= 0.25 && d.v > 0.7)) tear();
    else tween(0, 240, () => pk.classList.remove('is-touched')); // (and the hint comes back)
  };
  pk.addEventListener('pointerup', let_go);
  pk.addEventListener('pointercancel', let_go);
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
    if (e.target.closest('[data-dy-tear]')) return; // (the rip is a swipe: pointer events above)
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
  pk.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !ripped) { e.preventDefault(); dir = 1; pk.classList.add('is-touched'); tween(1, 420, tear); } });
}
// The tear line across a pack, a zigzag at CUT down from its top: the strip above it and the body below (clip-paths that
// meet exactly).
const TEAR = (() => {
  const CUT = 13, n = 12, pts = [];
  for (let i = 0; i <= n; i++) pts.push([+(i * 100 / n).toFixed(2), CUT + (i % 2 ? 1.6 : -0.6)]);
  const p = a => a.map(([x, y]) => `${x}% ${y}%`).join(',');
  return {top: `polygon(0% 0%,100% 0%,${p(pts.slice().reverse())})`, body: `polygon(${p(pts)},100% 100%,0% 100%)`, cut: CUT};
})();
function teamPicker(done) {
  const teams = Object.values(D.TEAMS).sort((a, b) => a.name.localeCompare(b.name));
  const body = `<div class="dy-teams">${teams.map(t => `<button type="button" class="dy-teamb" data-dy-team="${t.abbr}" style="--tp:${t.pri}"><img src="${esc(logoUrl(t.abbr, 72))}" alt="" loading="lazy" onerror="this.remove()"><span>${esc(t.name)}</span></button>`).join('')}</div>`;
  const sh = ui.openSheet({title: 'Pick a team', body, cls: 'dy-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-dy-team]');
    if (b) { sh.close(); setTimeout(() => done(b.dataset.dyTeam), 280); }
  });
}

// ---------------------------------------------------------------------------------------------------- the screen
const PANES = {home: homeHTML, store: storeHTML, cards: cardsHTML, deck: deckHTML, battle: battleHTML2};
function shellHTML() {
  return `<div class="dy" data-dy><div data-dy-wallet></div><div class="dy-tabs">${ui.seg({name: 'dy-tab', items: TABS, value: 'home'})}</div><div class="dy-pane" data-dy-pane></div></div>`;
}
function refresh(st) {
  if (st.dead) return;
  const el = st.el;
  // (Evan's and Ryan Stewart's alone, Oct 28 2026: a profile switched while it's open leaves it)
  if (!D.mayPlay()) { el.querySelector('[data-dy-pane]').innerHTML = ''; if (!st.left) { st.left = true; st.ctx.back(); } return; }
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
      if (q('[data-dy-addsheet]')) { addSheet(st); return; }
      if (q('[data-dy-autodeck]')) { D.setDeck(D.autoDeck(D.mine().o)); ui.haptic('success'); ui.toast('Your best deck is in', {icon: 'check-circle'}); refresh(st); return; }
      if (q('[data-dy-rename]')) { renameSheet(st); return; }
      const run = (r, then) => { if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; } ui.haptic('success'); if (then) then(r); refresh(st); };
      if ((b = q('[data-dy-challenge]'))) { run(MT.challenge(b.dataset.dyChallenge), () => ui.toast('Challenge sent. It’s on their Dynasty now.', {icon: 'check-circle'})); return; }
      if ((b = q('[data-dy-accept]'))) { run(MT.accept(b.dataset.dyAccept), r => ctx.nav(`/puzzles/dynasty/battle/${r.mid}`)); return; }
      if ((b = q('[data-dy-decline]'))) { run(MT.decline(b.dataset.dyDecline)); return; }
      if ((b = q('[data-dy-cancel]'))) { run(MT.cancel(b.dataset.dyCancel)); return; }
      if ((b = q('[data-dy-claimwin]'))) { run(MT.claim(b.dataset.dyClaimwin), () => ui.toast('Win claimed', {icon: 'trophy'})); return; }
      if ((b = q('[data-dy-go]'))) { ctx.nav(`/puzzles/dynasty/battle/${b.dataset.dyGo}`); }
    });
    st.stops.push(D.subscribe(why => { if (why !== 'change' && why !== 'open') refresh(st); }));
    st.stops.push(MT.subscribe(() => refresh(st)));
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') { if (D.status === 'ready' && D.mayPlay()) { D.sync(); D.earned(D.mine(), true); } if (st.tab === 'battle' || st.tab === 'home') refresh(st); } }));
    st.stops.push(data.subscribe(type => { if (type === 'me') refresh(st); }));
    st.stops.push(ctx.timer(() => { if (D.status === 'ready' && D.mayPlay() && st.tab === 'home') { const w = el.querySelector('[data-dy-wallet]'); if (w) w.innerHTML = walletHTML(D.mine()); } }, 15000));
    try { ui.lsSet('gg-dynasty-seen', '1'); } catch (_) {}
    D.load().then(() => refresh(st), () => refresh(st));
    D.loadGames().then(() => { if (D.status === 'ready' && D.mayPlay()) { D.earned(D.mine(), true); refresh(st); } });
    refresh(st);
  },

  // (back from a battle: the matches as they stand now)
  onShow(ctx) { const st = ST.get(ctx); if (st) refresh(st); },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    st.dead = true;
    st.stops.forEach(f => { try { f(); } catch (_) {} });
    D.flush(); MT.flush();
    ST.delete(ctx);
  }
};
