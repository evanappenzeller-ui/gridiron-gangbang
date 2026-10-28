// Gridiron Dynasty's page (/puzzles/dynasty, pushed over Daily Games; core/dynasty.js has the game), made to look and
// play like Pokémon TCG Pocket (the owner, Oct 28 2026: "I want the gameplay and theme/design to match the Pokémon app",
// with his screenshots of Pocket's booster pack, Battle and My Cards screens): Pocket's light theme, its own header
// and four tabs. Packs (the home: one big booster pack to open, its best cards above it, Offering Rates, Select other
// booster packs, pack points to trade for a card, today's free pack), My Cards (the binder: your cards, every card,
// the collections), Decks (your 20-card deck) and Battle (Versus: your matches against other players and challenges;
// Rankings: the Dynasty board, everyone's by the scoreboards' rule, CLAUDE.md; the Guide). A battle itself plays on its
// own screen (views/dynasty-battle.js, /puzzles/dynasty/battle/<id>).
// A pack opens over everything (openPack): you rip it open with a swipe across its top (the owner's ask, Oct 28 2026:
// "ripping it open by swiping across", with "a subtle hint showing players how to do this": a fingertip gliding along
// the tear line till you start), the strip tearing along your finger and flying off once you're far enough across
// (short of it, it springs back; Enter rips it too); then, as in Pocket, its cards one at a time (a ★ card with a shine
// first), tap for the next, and the lot at the end, new ones marked.
// The cards (cardHTML) are laid out as Pokémon cards: the type's colours, a stage, the name and HP with the type's
// symbol, the photo in its window (ESPN's headshot, else NFL.com's; a Legend his number), the position, team and OVR,
// any Ability, the attacks with their energy costs and damage, weakness and switch-out cost, and Pocket's rarity mark
// (◆ to ◆◆◆◆, ★, ★★, a crown: core/dynasty.js markOf); a ★ or crown card is full art. Coach, Item and Stadium cards
// (trainerHTML) are Trainer cards. battleHTML: a card's battle side in words, on its close-up.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-battle.js';
import * as MT from '../core/dynasty-match.js';

const esc = data.esc, nf = n => data.nf(n);
const ST = new WeakMap();
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------------------------------- pictures
export const headUrl = (h, w = 300) => {
  const s = String(h || '');
  if (!s) return '';
  if (s.startsWith('n:')) return `https://static.www.nfl.com/image/upload/f_auto,q_auto,w_${w}/league/${encodeURIComponent(s.slice(2))}`;
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${s.replace(/[^0-9]/g, '')}.png&w=${w}&h=${Math.round(w * 436 / 600)}`;
};
export const logoUrl = (abbr, w = 80) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${String(D.teamOf(abbr).espn || abbr).toLowerCase()}.png&w=${w}&h=${w}`;
const coinHTML = n => `<span class="pk-coin-n"><i class="pk-coin" aria-hidden="true"></i><b>${nf(n)}</b><span class="sr-only"> coins</span></span>`;

// ---------------------------------------------------------------------------------------------------- energy symbols
// Each Play Call's symbol, as Pokémon's energy symbols: Pass (a football in flight), Run (a cleat's chevrons), Blitz (a
// burst), Coverage (a shield), Any (a star: Pokémon's Colorless).
const GLYPH = {
  P: '<path d="M4.5 15.5c2-6 7-10.5 13-11 .5 6-4 11-11 13z" fill="#fff"/><path d="M8.5 11.5l4 4M10.5 9.8l1.6 1.6M12.6 8.2l1.6 1.6M8.7 12.2l1.6 1.6" stroke="currentColor" stroke-width="1.2"/>',
  R: '<path d="M4 6l6 6-6 6M11 6l6 6-6 6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  B: '<path d="M12 2.5l2.4 5.6 6-1.3-3.9 4.8 3.9 4.8-6-1.3L12 20.7l-2.4-5.6-6 1.3 3.9-4.8-3.9-4.8 6 1.3z" fill="#fff"/>',
  C: '<path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z" fill="#fff"/>',
  '*': '<path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.4l6-.7z" fill="#fff"/>'
};
const ENERGY_COLOR = {P: '#3D9BE9', R: '#4FAE3E', B: '#E8573A', C: '#9562D9', '*': '#A9A391'};
/** An energy symbol (e: P, R, B, C or *). */
export const pipHTML = e => `<i class="pk-e" style="--ec:${ENERGY_COLOR[e] || '#999'}" title="${esc(B.ENERGY[e])}"><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[e] || ''}</svg><span class="sr-only">${esc(B.ENERGY[e])}</span></i>`;
/** A type's symbol (A, G, B, C, S). */
const typeHTML = t => pipHTML(B.TYPES[t] ? B.TYPES[t].e : '*');

// ---------------------------------------------------------------------------------------------------- a card
/** A player card, laid out as a Pokémon card. o: {size: 's'|'m'|'l', count (copies held), ghost (not held), isNew, tag
 *  (a button: data-dy-card), cls}. */
export function cardHTML(c, o = {}) {
  if (!c) return '';
  const st = B.stats(c.id), T = D.teamOf(c.team), m = D.markOf(c), S = D.SERIES[c.s];
  const photo = c.head ? `<img class="pk-c-ph" src="${esc(headUrl(c.head, o.size === 'l' ? 520 : 300))}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : '';
  const legend = c.s === 'X' ? `<span class="pk-c-num" aria-hidden="true">${c.num}</span>` : '';
  const ab = st.ability ? `<span class="pk-c-ab"><i>Ability</i><b>${esc(B.ABILITY[st.ability].name)}</b></span><span class="pk-c-fx">${esc(B.ABILITY[st.ability].text)}</span>` : '';
  const atk = st.attacks.map(a => `<span class="pk-c-atk"><span class="pk-c-cost">${a.cost.map(pipHTML).join('')}</span><b>${esc(a.name)}</b><em>${a.dmg}${a.fx === 'coin' || a.fx === 'qb' || a.fx === 'vs' || a.fx === 'finish' ? '+' : ''}</em></span>`
    + (B.fxText(a) ? `<span class="pk-c-fx">${esc(B.fxText(a))}</span>` : '')).join('');
  const stage = st.stage ? `<span class="pk-c-stage is-1">STAGE 1</span>` : `<span class="pk-c-stage">BASIC</span>`;
  const strip = `${c.pos} · ${c.s === 'X' ? `${T.name} legend` : T.name}${c.num ? ` · #${c.num}` : ''} · OVR ${c.o}${c.t ? ` · ${c.t}` : ''}`;
  const label = `${c.name}, ${S.name} ${D.POS_NAME[c.pos] || c.pos}, ${st.hp} HP, ${B.TYPES[st.type].name} type, ${m.mark}${o.count > 1 ? `, ${o.count} copies` : ''}${o.ghost ? ', not in your collection' : ''}`;
  const inner = `<span class="pk-c-face" aria-hidden="true">`
    + `<span class="pk-c-head">${stage}<b class="pk-c-name">${esc(c.name)}</b><span class="pk-c-hp"><small>HP</small>${st.hp}</span>${typeHTML(st.type)}</span>`
    + `<span class="pk-c-art">${legend}${photo}<img class="pk-c-logo" src="${esc(logoUrl(c.team, 80))}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()"></span>`
    + `<span class="pk-c-strip">${esc(strip)}</span>`
    + `<span class="pk-c-body">${ab}${atk}</span>`
    + `<span class="pk-c-foot"><span><small>weakness</small>${st.weak ? `${typeHTML(st.weak)}<b>+${B.WEAK_BONUS}</b>` : ''}</span>`
    + `<span><small>retreat</small>${Array.from({length: st.retreat}, () => pipHTML('*')).join('')}</span></span>`
    + `<span class="pk-c-rar is-${m.kind}">${m.mark}</span><span class="pk-c-set">${esc(S.short)}${st.ex ? ' · ex' : ''}</span>`
    + `</span><span class="pk-c-shine" aria-hidden="true"></span>`
    + (o.isNew ? '<span class="pk-c-new" aria-hidden="true">NEW</span>' : '')
    + (o.count > 0 && !o.noCount ? `<span class="pk-c-cnt" aria-hidden="true">${o.count}</span>` : '');
  const cls = `pk-card t-${st.type} m-${m.kind}${m.n}${m.full ? ' is-full' : ''} s-${c.s} sz-${o.size || 'm'}${o.ghost ? ' is-ghost' : ''}${o.cls ? ' ' + o.cls : ''}`;
  const style = `--tp:${T.pri};--ts:${T.sec}`;
  return o.tag === false ? `<div class="${cls}" style="${style}" role="img" aria-label="${esc(label)}">${inner}</div>`
    : `<button type="button" class="${cls}" style="${style}" data-dy-card="${esc(c.id)}" aria-label="${esc(label)}">${inner}</button>`;
}
// A Supporter's whistle, an Item's bag and a Stadium's stands, drawn
const TRAINER_ART = {
  coach: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="38" r="14" fill="currentColor"/><rect x="24" y="24" width="30" height="12" rx="3" fill="currentColor"/><circle cx="24" cy="38" r="5" fill="rgba(255,255,255,.55)"/><path d="M50 24 58 14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  item: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="22" width="40" height="30" rx="6" fill="currentColor"/><path d="M24 22v-6a8 8 0 0 1 16 0v6" fill="none" stroke="currentColor" stroke-width="4"/><path d="M32 30v14M25 37h14" stroke="rgba(255,255,255,.8)" stroke-width="4" stroke-linecap="round"/></svg>',
  stadium: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 44c0-10 12-18 26-18s26 8 26 18v8H6z" fill="currentColor"/><path d="M14 44c0-6 8-11 18-11s18 5 18 11" fill="rgba(255,255,255,.45)"/><path d="M12 22v-8M52 22v-8M12 14l4 2-4 2M52 14l4 2-4 2" stroke="currentColor" stroke-width="2.5"/></svg>'
};
const TRAINER_KIND = {coach: 'Supporter', item: 'Item', stadium: 'Stadium'};
const TRAINER_RULE = {coach: 'You may play only 1 Supporter card during your turn.', item: 'You may play any number of Item cards during your turn.',
  stadium: 'This Stadium stays in play for both sides until another replaces it.'};
/** A Coach (Supporter), Item or Stadium card, laid out as a Pokémon Trainer card. o: as cardHTML's. */
export function trainerHTML(t, o = {}) {
  if (!t) return '';
  const T = t.team ? D.teamOf(t.team) : null, m = D.markOf(t);
  const label = `${t.name}, Trainer card, ${TRAINER_KIND[t.kind]}. ${t.text}${o.count > 1 ? `, ${o.count} copies` : ''}${o.ghost ? ', not in your collection' : ''}`;
  const inner = `<span class="pk-c-face" aria-hidden="true"><span class="pk-t-head"><b>Trainer</b><i>${TRAINER_KIND[t.kind]}</i></span>`
    + `<b class="pk-t-name">${esc(t.name)}</b>`
    + `<span class="pk-t-art">${TRAINER_ART[t.kind] || ''}${T ? `<img class="pk-t-logo" src="${esc(logoUrl(t.team, 96))}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : ''}</span>`
    + `<span class="pk-t-text">${esc(t.text)}</span><span class="pk-t-rule">${TRAINER_RULE[t.kind] || ''}</span>`
    + `<span class="pk-c-rar is-d">${m.mark}</span></span><span class="pk-c-shine" aria-hidden="true"></span>`
    + (o.isNew ? '<span class="pk-c-new" aria-hidden="true">NEW</span>' : '')
    + (o.count > 0 && !o.noCount ? `<span class="pk-c-cnt" aria-hidden="true">${o.count}</span>` : '');
  const cls = `pk-card pk-trainer k-${t.kind} m-d${m.n} sz-${o.size || 'm'}${o.ghost ? ' is-ghost' : ''}${o.cls ? ' ' + o.cls : ''}`;
  const style = T ? `--tp:${T.pri};--ts:${T.sec}` : '';
  return o.tag === false ? `<div class="${cls}" style="${style}" role="img" aria-label="${esc(label)}">${inner}</div>`
    : `<button type="button" class="${cls}" style="${style}" data-dy-card="${esc(t.id)}" aria-label="${esc(label)}">${inner}</button>`;
}
/** Any card by id: a player's or a Trainer card. */
export const anyHTML = (id, o = {}) => (D.card(id) ? cardHTML(D.card(id), o) : trainerHTML(D.trainer(id), o));
/** A card's battle side in words: type, HP, weakness and retreat, its Ability, its attacks. */
export function battleHTML(id) {
  const t = D.trainer(id);
  if (t) return `<div class="pk-info"><p class="pk-info-k">${TRAINER_KIND[t.kind]} · ${TRAINER_RULE[t.kind]}</p><p>${esc(t.text)}</p></div>`;
  const st = B.stats(id), c = D.card(id);
  if (!st) return '';
  const T = B.TYPES[st.type];
  const ab = st.ability ? `<div class="pk-ab"><b>Ability · ${esc(B.ABILITY[st.ability].name)}</b><span>${esc(B.ABILITY[st.ability].text)}</span></div>` : '';
  const atk = st.attacks.map(a => `<li><span class="pk-cost">${a.cost.map(pipHTML).join('')}</span><span class="pk-an"><b>${esc(a.name)}</b>`
    + `${B.fxText(a) ? `<small>${esc(B.fxText(a))}</small>` : ''}${a.note ? `<small>${esc(a.note)}</small>` : ''}${a.flat ? '<small>Ignores weakness.</small>' : ''}</span><em>${a.dmg}</em></li>`).join('');
  const stage = st.stage ? `Stage 1: evolves from ${esc(c.name)}’s Basic card` : 'Basic';
  return `<div class="pk-info"><div class="pk-info-h">${typeHTML(st.type)}<span>${esc(T.name)} · ${stage}${st.ex ? ' · ex: worth 2 points' : ''}</span><b>${st.hp} HP</b></div>`
    + ab + `<ul class="pk-atk">${atk}</ul>`
    + `<p class="pk-foot">Weakness ${st.weak ? `${typeHTML(st.weak)} +${B.WEAK_BONUS}` : 'none'} · Retreat ${st.retreat ? Array.from({length: st.retreat}, () => pipHTML('*')).join('') : 'free'}</p></div>`;
}
/** A card's back: its attributes and its real stat lines. */
function backHTML(c) {
  const keys = D.attrKeys(c.pos), T = D.teamOf(c.team);
  const bars = keys.map((k, i) => {
    const v = c.a[i] || 0;
    return `<li><span>${esc(D.ATTR_NAME[k] || k)}</span><i class="pk-bar"><b style="width:${v}%"></b></i><em>${v}</em></li>`;
  }).join('');
  const lines = [];
  if (c.s === 'X') lines.push(['Career', c.ln[0]]);
  else if (c.s === 'G') lines.push([c.t, c.ln[0]]);
  else if (c.s === 'A') lines.push([c.t, c.ln[0]], ['2025 season', c.ln[1]]);
  else { if (c.ln[0]) lines.push([`${D.DATA.season} so far`, c.ln[0]]); if (c.ln[1]) lines.push([`${D.DATA.season - 1} season`, c.ln[1]]); }
  const facts = [D.POS_NAME[c.pos], c.s === 'X' ? `Legend of the ${T.name}` : T.name, c.college ? c.college : '', c.exp ? `${c.exp} yr${c.exp === 1 ? '' : 's'} pro` : c.s === 'X' ? '' : 'Rookie']
    .filter(Boolean).join(' · ');
  return `<div class="pk-info"><p class="pk-info-k">${esc(D.SERIES[c.s].name)} · OVR ${c.o}</p><p>${esc(facts)}</p><ul class="pk-attrs">${bars}</ul>`
    + (lines.length ? `<dl class="pk-lines">${lines.filter(l => l[1]).map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '') + '</div>';
}
/** A card up close: the card, its battle side, its back, and what you can do with it. */
function cardSheet(st, id) {
  const c = D.anyCard(id);
  if (!c) return;
  const s = D.mine(), n = s.o[id] || 0, inDeck = s.dk.filter(x => x === id).length;
  D.markSeen([id]);
  const acts = [];
  if (n > inDeck && s.dk.length < B.DECK_SIZE) acts.push(ui.button({label: 'Add to my deck', kind: 'primary', block: true, attrs: {'data-dy-add': id}}));
  if (inDeck) acts.push(ui.button({label: 'Take out of my deck', kind: 'secondary', block: true, attrs: {'data-dy-rm': id}}));
  if (n > inDeck) acts.push(ui.button({label: `Quick sell for ${nf(D.sellValue(c))} coins`, kind: 'secondary', block: true, attrs: {'data-dy-sell': id}}));
  if (!n && D.ppCost(c)) acts.push(ui.button({label: `Get it for ${nf(D.ppCost(c))} pack points`, kind: s.pp >= D.ppCost(c) ? 'primary' : 'secondary', block: true, attrs: {'data-dy-pp': id}, disabled: s.pp < D.ppCost(c)}));
  const body = `<div class="pk-zoom">${anyHTML(id, {size: 'l', tag: false, ghost: !n, noCount: true})}</div>`
    + `<p class="pk-own">${n ? `${n} in your collection${inDeck ? ` · ${inDeck} in your deck` : ''}` : 'Not in your collection yet'}</p>`
    + (acts.length ? `<div class="pk-acts">${acts.join('')}</div>` : '') + battleHTML(id) + (D.card(id) ? backHTML(c) : '');
  const sh = ui.openSheet({title: c.name, body, cls: 'pk-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    if (e.target.closest('[data-dy-sell]')) {
      const r = D.sell(id, 1);
      if (r.ok) { ui.haptic('success'); ui.toast(`Sold for ${nf(r.coins)} coins`, {icon: 'check-circle'}); sh.close(); refresh(st); }
      return;
    }
    if (e.target.closest('[data-dy-pp]')) {
      const r = D.exchange(id);
      if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
      ui.haptic('success'); ui.toast(`${c.name} is yours`, {icon: 'check-circle'}); sh.close(); refresh(st); return;
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

// ---------------------------------------------------------------------------------------------------- a booster pack
// Pocket's foil packs: the brand bar across the top (where it tears), the pack's art (its emblem in a burst of light, a
// fan of cards behind), its name in a plate below.
const PACK_ART = {
  std: '<ellipse cx="50" cy="50" rx="30" ry="18" transform="rotate(-35 50 50)" fill="#7B4A26"/><path d="M38 55l24-14M43 52.5l-2.5-4M47.5 50l-2.5-4M52 47.5l-2.5-4M56.5 45l-2.5-4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  team: '<path d="M24 58c0-18 12-30 28-30 14 0 24 9 24 22v8H62v10H40l-6-10z" fill="#fff"/><path d="M62 50h16M56 58h20" stroke="rgba(0,0,0,.35)" stroke-width="3"/><circle cx="46" cy="44" r="4" fill="rgba(0,0,0,.3)"/>',
  prem: '<path d="M50 18l9 20 22 2-17 14 5 22-19-12-19 12 5-22-17-14 22-2z" fill="#fff"/>',
  gday: '<path d="M20 70h60M30 70V36M70 70V36" stroke="#fff" stroke-width="4"/><rect x="22" y="22" width="16" height="12" rx="2" fill="#fff"/><rect x="62" y="22" width="16" height="12" rx="2" fill="#fff"/><path d="M38 28l14 22M62 28L48 50" stroke="rgba(255,255,255,.55)" stroke-width="6"/>',
  leg: '<path d="M22 64l-4-30 16 12 16-22 16 22 16-12-4 30z" fill="#fff"/><path d="M22 70h56" stroke="#fff" stroke-width="5"/>'
};
function packHTML(kind, {count, big} = {}) {
  const P = D.PACKS[kind];
  return `<span class="pk-pack${big ? ' is-big' : ''} k-${kind}" style="--pc:${P.color}" aria-hidden="true">`
    + `<span class="pk-pack-top"><i class="pk-pack-ball"></i><b>GRIDIRON<small>DYNASTY</small></b><em>GD1</em></span>`
    + `<span class="pk-pack-art"><span class="pk-pack-fan"><i></i><i></i><i></i></span><svg viewBox="0 0 100 100">${PACK_ART[kind] || ''}</svg></span>`
    + `<span class="pk-pack-name"><small>${kind === 'leg' ? 'DELUXE PACK' : 'BOOSTER PACK'}</small><b>${esc(P.name.replace(' Pack', '').toUpperCase())}</b></span>`
    + `<span class="pk-pack-foil"></span><span class="pk-pack-crimp"></span>${count > 1 ? `<span class="pk-pack-n">×${count}</span>` : ''}</span>`;
}
/** The best cards a pack can give (its preview, above the pack). */
function packBest(kind, n = 5) {
  const pools = {std: c => c.s === 'L', team: c => c.s === 'L', prem: c => c.s === 'L' || c.s === 'R' || c.s === 'G', gday: c => c.s === 'G', leg: c => c.s === 'X' || c.s === 'P'};
  const f = pools[kind] || pools.std;
  return D.CARDS.filter(f).sort((a, b) => b.o - a.o).slice(0, n);
}

// ---------------------------------------------------------------------------------------------------- the header and tabs
const TABS = [
  {id: 'packs', label: 'Packs', title: 'Packs', ic: '<path d="M7 4h10l1 3H6zM6 7h12v13H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12h6M9 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'},
  {id: 'cards', label: 'My Cards', title: 'My Cards', ic: '<rect x="6" y="3.5" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="8.5" y="6" width="7" height="6" rx="1" fill="currentColor"/>'},
  {id: 'decks', label: 'Decks', title: 'Decks', ic: '<path d="M5 8h14v11H5zM7 5h10v3H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/>'},
  {id: 'battle', label: 'Battle', title: 'Battle', ic: '<path d="M4 20l7-7M6 13l5 5M14.5 4H20v5.5L11 18.5M20 20l-7-7M18 13l-5 5M9.5 4H4v5.5l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'}
];
function shellHTML() {
  return `<div class="pk" data-dy><header class="pk-hdr">${ui.exitButton('data-dy-exit', 'Exit Gridiron Dynasty')}`
    + `<h1 class="pk-title" data-pk-title>Packs</h1><span class="pk-wallet" data-dy-wallet></span></header>`
    + `<nav class="pk-nav" aria-label="Gridiron Dynasty">${TABS.map((t, i) => `<button type="button" class="pk-tab${i === 0 ? ' is-on' : ''}" data-dy-tab="${t.id}" aria-pressed="${i === 0}">`
      + `<svg viewBox="0 0 24 24" aria-hidden="true">${t.ic}</svg><span>${t.label}</span><i class="pk-dot" hidden></i></button>`).join('')}</nav>`
    + `<div class="pk-pane" data-dy-pane></div></div>`;
}

// ---------------------------------------------------------------------------------------------------- Packs
const untilMidnight = () => { const d = new Date(), m = new Date(d); m.setHours(24, 0, 0, 0); return m - d; };
function packsHTML(st) {
  const s = D.mine(), kind = st.pack, P = D.PACKS[kind], have = s.pk[kind] || 0, free = D.dailyReady(s) && kind === D.DAILY_PACK;
  const wait = MT.waiting(), ready = D.claimable(s);
  const best = packBest(kind);
  const slots = P.slots.reduce((t, x) => t + x.n, 0);
  const open = free ? 'Open free pack' : have ? `Open${have > 1 ? ` (${have})` : ''}` : `Open · ${nf(P.price)}`;
  const note = kind === 'prem' ? '1 Gold or better guaranteed' : kind === 'gday' ? '1 Gameday card guaranteed' : kind === 'leg' ? '1 card 90+ guaranteed' : '1 Trainer card in every pack';
  let h = '';
  if (wait) h += `<button type="button" class="pk-alert" data-dy-tab="battle">${ui.icon('versus', {size: 20})}<span>${wait === 1 ? 'A battle is' : `${wait} battles are`} waiting on you</span>${ui.icon('chevron-right', {size: 16})}</button>`;
  if (ready.length) h += `<button type="button" class="pk-alert is-gold" data-dy-goto="cols">${ui.icon('trophy', {size: 20})}<span>${ready.length === 1 ? 'A collection is' : `${ready.length} collections are`} complete: claim your reward</span>${ui.icon('chevron-right', {size: 16})}</button>`;
  h += `<div class="pk-free"><span class="pk-free-b${D.dailyReady(s) ? ' is-ready' : ''}"><i class="pk-free-i"></i><b>${D.dailyReady(s) ? 'Free pack ready' : `Next free pack in ${esc(ui.untilText(untilMidnight()))}`}</b></span>`
    + `<button type="button" class="pk-q" data-dy-earn aria-label="How you earn coins">?</button></div>`;
  h += `<div class="pk-show" style="--pc:${P.color}"><span class="pk-show-tag">${ui.icon('star', {size: 14})}Top cards in this pack</span>`
    + `<div class="pk-show-row">${best.map(c => cardHTML(c, {size: 's', tag: false, noCount: true})).join('')}</div></div>`;
  h += `<div class="pk-stage" style="--pc:${P.color}"><div class="pk-ribbon"><b>${esc(P.name)}</b><span>1 pack contains ${slots} cards</span><span>${esc(note)}</span></div>`
    + `<button type="button" class="pk-bigpack" data-dy-openhere aria-label="${esc(`${open}: ${P.name}`)}">${packHTML(kind, {big: true, count: have})}</button>`
    + `<span class="pk-reflect" aria-hidden="true">${packHTML(kind, {big: true})}</span>`
    + `<button type="button" class="pk-pts" data-dy-points aria-label="Pack points: ${nf(s.pp)}"><i class="pk-pts-i"></i><b>${nf(s.pp)} pts</b></button></div>`;
  h += `<div class="pk-actions"><button type="button" class="pk-pill" data-dy-odds="${kind}">Offering Rates</button>`
    + `<button type="button" class="pk-open" data-dy-openhere>${esc(open)}</button>`
    + `<button type="button" class="pk-pill is-r" data-dy-packs>Select other booster packs ${ui.icon('chevron-right', {size: 14})}</button></div>`;
  const lp = s.lp.filter(D.isCard).slice(0, 10);
  if (lp.length) h += `<section class="pk-sec"><h2 class="pk-h">Latest pulls</h2><div class="pk-rail" data-hscroll>${lp.map(id => anyHTML(id, {size: 's', isNew: D.isNew(id, s), noCount: true})).join('')}</div></section>`;
  return h;
}
function oddsSheet(kind) {
  const P = D.PACKS[kind];
  const pool = {live: 'Live Series', trainer: 'a Trainer card (Supporter, Item or Stadium)', all: 'Live Series, Rookie, Gameday, Prime and Awards', gameday: 'a Gameday card (this week’s three times as likely)', elite: 'Legend 25%, Prime 30%, Award 20%, Gameday 25%, all 90+'};
  const sym = {common: '◆', bronze: '◆◆', silver: '◆◆◆', gold: '◆◆◆◆', diamond: '★'};
  const body = D.packOdds(kind).map(g => `<section class="pk-odds"><h3>${g.n === 1 ? '1 card' : `${g.n} cards`}: ${esc(pool[g.pool] || g.pool)}</h3>`
    + `<ul>${g.odds.map(o => `<li><span class="pk-sym">${g.pool === 'trainer' ? (o.r === 'gold' ? '◆◆◆' : '◆◆') : g.pool === 'elite' || g.pool === 'gameday' ? '★★ ♛' : sym[o.r]}</span>${esc(g.pool === 'trainer' ? (o.r === 'gold' ? 'Gold' : 'Silver') : D.RARITY_NAME[o.r])}<b>${o.pct}%</b></li>`).join('')}</ul></section>`).join('')
    + '<p class="pk-note">◆ Common (64 and under) · ◆◆ Bronze (65–74) · ◆◆◆ Silver (75–79) · ◆◆◆◆ Gold (80–84) · ★ Diamond (85+) · ★★ Prime, Gameday and Award cards · ♛ Legends. Every pack also gives 5 pack points.</p>';
  ui.openSheet({title: 'Offering Rates', body: `<p class="pk-note">${esc(P.name)}</p>` + body, cls: 'pk-sheet', detents: ['fit']});
}
function packsSheet(st) {
  const s = D.mine();
  const body = `<div class="pk-pick">${D.PACK_ORDER.map(k => `<button type="button" class="pk-pickb${k === st.pack ? ' is-on' : ''}" data-dy-pick="${k}">${packHTML(k, {count: s.pk[k]})}`
    + `<span><b>${esc(D.PACKS[k].name)}</b><small>${esc(D.PACKS[k].blurb)}</small><em>${s.pk[k] ? `${s.pk[k]} to open` : `${nf(D.PACKS[k].price)} coins`}</em></span></button>`).join('')}</div>`;
  const sh = ui.openSheet({title: 'Select a booster pack', body, cls: 'pk-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-dy-pick]');
    if (b) { st.pack = b.dataset.dyPick; ui.haptic('selection'); sh.close(); refresh(st); }
  });
}
function earnSheet() {
  const s = D.mine(), E = D.earned(s);
  const rows = Object.keys(D.PAY).map(g => `<li><span><b>${esc(D.GAME_NAME[g])}</b><small>${esc(D.PAY_WORDS[g])}</small></span><em>${E.today[g] ? '+' + nf(E.today[g]) : '–'}</em></li>`).join('');
  const body = `<p class="pk-note">Coins open packs. The Daily Games pay them: each game’s first finished result of the day, from the day your Dynasty began. You’ve earned ${nf(E.total)} from ${E.days} game${E.days === 1 ? '' : 's'}.</p>`
    + `<ul class="pk-list">${rows}</ul>`
    + `<p class="pk-note">You also get a free Standard Pack every day, ${nf(D.BATTLE_PAY.w.coins)} coins for a battle won (${nf(D.BATTLE_PAY.l.coins)} for a loss), coins for quick-selling cards, and collection rewards. Every pack opened gives ${D.PP_PER_PACK} pack points, to trade for a card you don’t have.</p>`;
  ui.openSheet({title: 'Coins', body, cls: 'pk-sheet', detents: ['large']});
}
function pointsSheet(st) {
  const s = D.mine();
  let q = '';
  const draw = () => {
    const nq = data.norm(q);
    const list = D.CARDS.filter(c => !(s.o[c.id] > 0) && (!nq || data.norm(`${c.name} ${c.team} ${D.teamOf(c.team).name}`).includes(nq)))
      .sort((a, b) => b.o - a.o).slice(0, 45).concat(nq ? [] : D.TRAINER_IDS.filter(id => !(s.o[id] > 0)).map(D.trainer));
    return list.length ? `<div class="pk-grid">${list.map(c => `<div class="pk-ppcell">${anyHTML(c.id, {size: 's', noCount: true})}<span class="pk-ppcost${s.pp >= D.ppCost(c) ? '' : ' is-off'}">${nf(D.ppCost(c))} pts</span></div>`).join('')}</div>`
      : ui.empty({icon: 'search', title: 'No cards like that', body: 'Try another name.'});
  };
  const body = `<p class="pk-note">You have <b>${nf(s.pp)} pack points</b>. Every pack you open gives ${D.PP_PER_PACK}. Trade them for a card you don’t have yet: ◆ 35 · ◆◆ 70 · ◆◆◆ 150 · ◆◆◆◆ 500 · ★ 400 · ★★ 1,250 · ♛ 2,500.</p>`
    + `<div class="pk-search">${ui.searchField({name: 'dy-ppq', placeholder: 'Search players or teams'})}</div><div data-dy-pplist>${draw()}</div>`;
  const sh = ui.openSheet({title: 'Pack points', body, cls: 'pk-sheet', detents: ['large']});
  let qt = 0;
  sh.body.addEventListener('input', e => { if (e.target.name === 'dy-ppq') { q = e.target.value; clearTimeout(qt); qt = setTimeout(() => { sh.body.querySelector('[data-dy-pplist]').innerHTML = draw(); }, 180); } });
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-dy-card]'); if (b) cardSheet(st, b.dataset.dyCard); });
}

// ---------------------------------------------------------------------------------------------------- My Cards
const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];
const PAGE = 60;
function cardsHTML(st) {
  const f = st.f, s = D.mine(), own = D.owned(s);
  const filters = (f.ser ? 1 : 0) + (f.pos ? 1 : 0) + (f.rar ? 1 : 0);
  let h = `<div class="pk-panel pk-binder"><div class="pk-binder-b">`
    + `<button type="button" class="pk-tile${f.view !== 'cols' ? ' is-on' : ''}" data-dy-cv="mine">${TILE.binder}<span>Binder</span></button>`
    + `<button type="button" class="pk-tile${f.view === 'cols' ? ' is-on' : ''}" data-dy-cv="cols">${TILE.cols}<span>Collections</span>${D.claimable(s).length ? '<i class="pk-bang">!</i>' : ''}</button>`
    + `<button type="button" class="pk-tile" data-dy-tab="decks">${TILE.decks}<span>Decks</span></button></div>`;
  if (f.view === 'cols') return h + '</div>' + colsHTML(st);
  h += `<div class="pk-binder-r"><span class="pk-count">${TILE.card}<b>${nf(own.have)}</b><small>/ ${nf(own.of)}</small></span>`
    + `<button type="button" class="pk-toggle${f.view === 'all' ? ' is-on' : ''}" data-dy-all aria-pressed="${f.view === 'all'}" aria-label="Show every card in the game"><i></i></button>`
    + `<button type="button" class="pk-iconb${filters ? ' is-on' : ''}" data-dy-filter aria-label="Filter">${ui.icon('sort', {size: 20})}${filters ? `<i>${filters}</i>` : ''}</button></div>`
    + `<div class="pk-search">${ui.searchField({name: 'dy-q', placeholder: 'Search players, teams or cards', value: f.q})}</div></div>`;
  const sp = D.spares(s);
  if (sp.list.length && f.view === 'mine') h += `<button type="button" class="pk-alert is-soft" data-dy-spares>${ui.icon('bolt', {size: 18})}<span>Quick sell ${sp.list.reduce((t, x) => t + x.n, 0)} spare cop${sp.list.reduce((t, x) => t + x.n, 0) === 1 ? 'y' : 'ies'} for ${nf(sp.coins)} coins</span></button>`;
  return h + '<div data-dy-grid></div>';
}
const TILE = {
  binder: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 3.5v17M17 6h2v14a2 2 0 0 1-2 2H9" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  cols: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.4 5 5.4.6-4 3.7 1.1 5.3L12 15.4l-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  decks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14v11H5zM7 5h10v3H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3.5" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
};
function filterSheet(st) {
  const f = st.f;
  const body = `<h3 class="pk-h">Series</h3>${ui.chips({name: 'dy-ser', items: [{id: '', label: 'All'}, ...D.SERIES_ORDER.map(k => ({id: k, label: D.SERIES[k].name})), {id: 'T', label: 'Trainer'}], value: f.ser})}`
    + `<h3 class="pk-h">Position</h3>${ui.chips({name: 'dy-pos', items: [{id: '', label: 'All'}, ...POS_ORDER.map(p => ({id: p, label: p}))], value: f.pos})}`
    + `<h3 class="pk-h">Rarity</h3>${ui.chips({name: 'dy-rar', items: [{id: '', label: 'Any'}, ...D.RARITY.slice().reverse().map(r => ({id: r, label: {common: '◆', bronze: '◆◆', silver: '◆◆◆', gold: '◆◆◆◆', diamond: '★'}[r]}))], value: f.rar})}`
    + `<div class="pk-acts">${ui.button({label: 'Clear filters', kind: 'secondary', block: true, attrs: {'data-dy-clearf': ''}})}</div>`;
  const sh = ui.openSheet({title: 'Filter', body, cls: 'pk-sheet', detents: ['fit']});
  sh.body.addEventListener('ui:change', e => { const {name, value} = e.detail || {}; if (/^dy-(ser|pos|rar)$/.test(name)) { f[name.slice(3)] = value; refresh(st); } });
  sh.body.addEventListener('click', e => { if (e.target.closest('[data-dy-clearf]')) { f.ser = f.pos = f.rar = ''; sh.close(); refresh(st); } });
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
  const cards = list.slice(0, st.shown).map(c => anyHTML(c.id, {size: 's', count: s.o[c.id] || 0, ghost: !(s.o[c.id] > 0), isNew: D.isNew(c.id, s)})).join('');
  host.innerHTML = list.length ? `<div class="pk-grid">${cards}</div>` + (list.length > st.shown ? `<button type="button" class="pk-more" data-dy-more>Show more (${nf(list.length - st.shown)})</button>` : '')
    : ui.empty({icon: 'search', title: st.f.view === 'mine' ? 'No cards like that yet' : 'No cards like that', body: st.f.view === 'mine' ? 'Open packs to fill your binder.' : 'Try another filter.'});
}
function colsHTML(st) {
  const s = D.mine(), groups = [['Series', c => c.kind === 'series'], ['Gameday weeks', c => c.kind === 'week'], ['Divisions and the league', c => c.kind === 'div' || c.kind === 'league'], ['Teams', c => c.kind === 'team']];
  const row = col => {
    const p = D.progress(col, s);
    const btn = p.claimed ? `<span class="pk-done">${ui.icon('check-circle', {size: 16})}Claimed</span>` : p.done ? `<button type="button" class="pk-claim" data-dy-claim="${col.id}">Claim</button>` : `<span class="pk-n">${p.have}/${p.of}</span>`;
    const lead = col.team ? `<img class="pk-col-logo" src="${esc(logoUrl(col.team, 64))}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="pk-col-ic">${ui.icon(col.kind === 'week' ? 'calendar' : col.kind === 'series' ? 'star' : 'crown', {size: 20})}</span>`;
    return `<li class="${p.done && !p.claimed ? 'is-ready' : ''}"><button type="button" class="pk-col-b" data-dy-col="${col.id}">${lead}<span class="pk-col-t"><b>${esc(col.name)}</b><small>${esc(D.rewardText(col.reward))}</small>`
      + `<i class="pk-bar"><b style="width:${Math.round(p.have / Math.max(1, p.of) * 100)}%"></b></i></span></button>${btn}</li>`;
  };
  return `<p class="pk-note">Collect a set to earn its reward: a team’s ten best Live cards, a division’s four teams, the whole league, and the special series.</p>`
    + groups.map(([t, f]) => `<section class="pk-sec"><h2 class="pk-h">${esc(t)}</h2><ul class="pk-list pk-cols">${D.COLLECTIONS.filter(f).map(row).join('')}</ul></section>`).join('');
}
function colSheet(st, id) {
  const col = D.collection(id), s = D.mine();
  if (!col) return;
  const p = D.progress(col, s);
  let body = `<p class="pk-note">Reward: <b>${esc(D.rewardText(col.reward))}</b>. ${p.claimed ? 'Claimed.' : p.done ? 'Complete: claim it!' : `${p.have} of ${p.of} so far.`}</p>`;
  if (p.done && !p.claimed) body += `<div class="pk-acts">${ui.button({label: 'Claim reward', kind: 'primary', block: true, attrs: {'data-dy-claim': id}})}</div>`;
  if (col.need) {
    const need = col.need.filter(D.isCard);
    body += `<p class="pk-note">${(col.kind === 'series' || col.kind === 'week') && col.of < need.length ? `Any ${col.of} of these count.` : 'Every one of these.'}</p><div class="pk-grid">${need.map(id => anyHTML(id, {size: 's', ghost: !(s.o[id] > 0), noCount: true})).join('')}</div>`;
  } else body += `<ul class="pk-list">${col.sub.map(D.collection).filter(Boolean).map(c => `<li><span class="pk-col-t"><b>${esc(c.name)}</b></span><span class="pk-n">${s.cl[c.id] ? ui.icon('check-circle', {size: 16}) : `${D.progress(c, s).have}/${c.of}`}</span></li>`).join('')}</ul>`;
  if (col.reward.card) body += `<p class="pk-note">The reward card:</p><div class="pk-zoom is-s">${cardHTML(D.card(col.reward.card), {size: 'm', tag: false})}</div>`;
  const sh = ui.openSheet({title: col.name, body, cls: 'pk-sheet', detents: ['large']});
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
  try { ui.confetti(st.el.getBoundingClientRect(), {colors: ['#6DD3F5', '#FFD94A', '#F27BB8', '#FFFFFF']}); } catch (_) {}
  ui.toast(`Claimed: ${D.rewardText(r.reward)}`, {icon: 'trophy', duration: 3200});
  refresh(st);
}

// ---------------------------------------------------------------------------------------------------- Decks
function decksHTML(st) {
  const s = D.mine(), dk = D.deckOf(s);
  const counts = {};
  dk.ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const order = id => (D.card(id) ? 0 : D.trainer(id).kind === 'coach' ? 1 : D.trainer(id).kind === 'item' ? 2 : 3);
  const uniq = Object.keys(counts).sort((a, b) => order(a) - order(b) || (D.card(b) ? D.card(b).o : 0) - (D.card(a) ? D.card(a).o : 0));
  const stars = uniq.filter(id => D.card(id)).slice(0, 2);
  let h = `<div class="pk-deckbox"><div class="pk-deckbox-cards">${stars.map((id, i) => `<span style="--i:${i}">${cardHTML(D.card(id), {size: 's', tag: false, noCount: true})}</span>`).join('')}</div>`
    + `<div class="pk-deckbox-t"><button type="button" class="pk-deckname" data-dy-rename>${esc(D.teamName(s))} ${ui.icon('gear', {size: 14})}</button>`
    + `<span class="pk-deck-en">${dk.types.map(pipHTML).join('')}<small>${esc(dk.types.map(e => B.ENERGY[e]).join(' · '))}</small></span>`
    + `<span class="pk-deck-n${dk.ok ? ' is-ok' : ''}">${dk.ids.length}/${B.DECK_SIZE}${dk.ok ? ' · Ready to battle' : ''}</span>${dk.ok ? '' : `<span class="pk-warn">${esc(dk.why)}</span>`}</div></div>`;
  h += `<div class="pk-actions is-deck"><button type="button" class="pk-pill" data-dy-addsheet>${ui.icon('plus', {size: 14})} Add cards</button>`
    + `<button type="button" class="pk-pill" data-dy-autodeck>${ui.icon('bolt', {size: 14})} Build my best deck</button></div>`;
  h += `<p class="pk-note">20 cards, at most 2 of any player or card, at least one Basic player. Your players’ types decide your energy: one or two types work best. Tap a card to see it or take it out.</p>`;
  h += `<div class="pk-grid">${uniq.map(id => anyHTML(id, {size: 's', count: counts[id]})).join('')}</div>`;
  return h;
}
function addSheet(st) {
  const s = D.mine();
  const draw = kind => {
    const inDeck = id => s.dk.filter(x => x === id).length;
    const ids = Object.keys(s.o).filter(id => D.isCard(id) && s.o[id] > inDeck(id))
      .filter(id => (kind === 'players' ? !!D.card(id) : !!D.trainer(id)))
      .sort((a, b) => (D.card(b) ? D.card(b).o : 0) - (D.card(a) ? D.card(a).o : 0));
    return `<p class="pk-note">${s.dk.length} of ${B.DECK_SIZE} in your deck. Tap a card to add it.</p>`
      + (ids.length ? `<div class="pk-grid">${ids.map(id => anyHTML(id, {size: 's', count: s.o[id] - inDeck(id)})).join('')}</div>` : ui.empty({icon: 'search', title: 'Nothing more to add', body: 'Open packs for more cards.'}));
  };
  let kind = 'players';
  const body = ui.seg({name: 'dy-addk', items: [{id: 'players', label: 'Players'}, {id: 'trainers', label: 'Trainers'}], value: kind, small: true}) + `<div data-dy-addlist>${draw(kind)}</div>`;
  const sh = ui.openSheet({title: 'Add to your deck', body, cls: 'pk-sheet', detents: ['large']});
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
  const body = `<label class="pk-field"><span>Deck name</span><input type="text" maxlength="24" value="${esc(s.nm || D.teamName(s))}" data-dy-nm autocomplete="off"></label>`
    + `<div class="pk-acts">${ui.button({label: 'Save', kind: 'primary', block: true, attrs: {'data-dy-nm-save': ''}})}</div>`;
  const sh = ui.openSheet({title: 'Name your deck', body, cls: 'pk-sheet', detents: ['fit']});
  sh.body.addEventListener('click', e => {
    if (!e.target.closest('[data-dy-nm-save]')) return;
    const v = sh.body.querySelector('[data-dy-nm]').value.trim().replace(/\s+/g, ' ').slice(0, 24);
    s.nm = v === D.teamName({nm: ''}) ? '' : v; D.touch(); sh.close(); refresh(st);
  });
}

// ---------------------------------------------------------------------------------------------------- Battle
// Pocket's Battle screen: the banner, then Versus (your matches and challenges) and Rankings, the Guide and Decks.
const ago = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const avatarOf = (o, size = 36) => (o.member ? ui.avatar(o.member, {size}) : ui.nickAvatar(o.name, {size}));
function battleHome(st) {
  const wait = MT.waiting(), s = D.mine();
  const fan = ['Tom Brady', 'Jerry Rice', 'Lawrence Taylor'].map(n => D.CARDS.find(c => c.s === 'X' && c.name === n)).filter(Boolean);
  return `<div class="pk-banner"><b>Battle</b><span class="pk-banner-fan">${fan.map((c, i) => `<span style="--i:${i}">${cardHTML(c, {size: 's', tag: false, noCount: true})}</span>`).join('')}</span></div>`
    + `<div class="pk-modes"><button type="button" class="pk-mode" data-dy-bv="versus">${MODE_IC.versus}<b>Versus</b><small>Challenge a friend</small>${wait ? '<i class="pk-bang">!</i>' : ''}</button>`
    + `<button type="button" class="pk-mode" data-dy-bv="rank">${MODE_IC.rank}<b>Rankings</b><small>${nf(s.tr)} trophies · ${s.rec.w}–${s.rec.l}</small></button></div>`
    + `<div class="pk-modes is-small"><button type="button" class="pk-mini" data-dy-guide>${MODE_IC.guide}<span>Guide</span></button>`
    + `<button type="button" class="pk-mini" data-dy-tab="decks">${TILE.decks}<span>Decks</span></button></div>`;
}
const MODE_IC = {
  versus: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l4 8 9-3-2 9 9 4-9 4 2 9-9-3-4 8-4-8-9 3 2-9-9-4 9-4-2-9 9 3z" fill="#E8F7FF" stroke="#25A9E0" stroke-width="2.4" stroke-linejoin="round"/><circle cx="19" cy="22" r="4" fill="#25A9E0"/><circle cx="30" cy="26" r="4" fill="#25A9E0"/></svg>',
  rank: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8h20v8a10 10 0 0 1-20 0z" fill="#FFF6D6" stroke="#E0A31A" stroke-width="2.4"/><path d="M14 11H8a6 6 0 0 0 6 7M34 11h6a6 6 0 0 1-6 7M24 26v8M16 40h16l-2-6H18z" fill="none" stroke="#E0A31A" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};
function versusHTML(st) {
  const s = D.mine(), dk = D.deckOf(s), all = MT.list();
  const row = (x, sub, btns) => `<li>${avatarOf(x.opp)}<span class="pk-row-t"><b>${esc(x.opp.name)}${x.opp.guest ? ' <i class="pk-tag">Guest</i>' : ''}</b><small>${sub}</small></span>${btns}</li>`;
  const score = x => (x.G ? `${x.G.p[x.you].pts}–${x.G.p[1 - x.you].pts}` : '');
  const sec = (title, items, f) => (items.length ? `<section class="pk-sec"><h2 class="pk-h">${title}</h2><ul class="pk-list">${items.map(f).join('')}</ul></section>` : '');
  const btn = (label, attrs, kind = 'go') => `<button type="button" class="pk-btn is-${kind}" ${attrs}>${label}</button>`;
  let h = `<button type="button" class="pk-backrow" data-dy-bv="">${ui.icon('chevron-left', {size: 16})} Battle</button>`;
  if (!dk.ok) h += `<button type="button" class="pk-alert is-gold" data-dy-tab="decks">${ui.icon('info', {size: 18})}<span>Your deck isn’t ready: ${esc(dk.why)}</span>${ui.icon('chevron-right', {size: 16})}</button>`;
  h += sec('Your move', all.filter(x => ['invite', 'setup', 'yours'].includes(x.state)), x => x.state === 'invite'
    ? row(x, 'Challenged you to a battle', `<span class="pk-btns">${btn('Accept', `data-dy-accept="${x.mid}"${dk.ok ? '' : ' disabled'}`)}${btn('Decline', `data-dy-decline="${x.mid}"`, 'soft')}</span>`)
    : row(x, x.state === 'setup' ? 'Pick your starting lineup' : `Your turn · ${score(x)}`, btn('Play', `data-dy-go="${x.mid}"`)));
  h += sec('Their move', all.filter(x => x.state === 'theirs'), x => row(x, `Waiting ${ago(x.idle)} · ${score(x) || 'setting up'}`,
    x.idle >= MT.IDLE_MS ? btn('Claim win', `data-dy-claimwin="${x.mid}"`, 'soft') : btn('View', `data-dy-go="${x.mid}"`, 'soft')));
  h += sec('Challenges sent', all.filter(x => x.state === 'sent'), x => row(x, 'Waiting for them to accept', btn('Cancel', `data-dy-cancel="${x.mid}"`, 'soft')));
  const busy = new Set(all.filter(x => !['over', 'closed'].includes(x.state)).map(x => x.opp.key));
  const opp = D.others();
  h += `<section class="pk-sec"><h2 class="pk-h">Friend battle</h2>`;
  h += opp.length ? `<ul class="pk-list">${opp.map(o => `<li>${avatarOf(o)}<span class="pk-row-t"><b>${esc(o.name)}${o.guest ? ' <i class="pk-tag">Guest</i>' : ''}</b>`
    + `<small>${esc(o.team)} · ${nf(o.tr)} trophies · ${o.rec.w}–${o.rec.l}</small></span>`
    + (busy.has(o.key) ? '<span class="pk-n">In a battle</span>' : btn('Challenge', `data-dy-challenge="${o.key}"${dk.ok ? '' : ' disabled'}`)) + '</li>').join('')}</ul>`
    : `<p class="pk-note">${daily.LB.ready ? 'Your opponent hasn’t opened Gridiron Dynasty yet. Once they do, you can challenge them here.' : 'Loading the other players…'}</p>`;
  h += '</section>';
  h += sec('Finished', all.filter(x => x.state === 'over').slice(0, 10), x => row(x, `${{points: 'Three points', empty: 'No players left', time: 'Turn limit', resign: 'Resigned', claim: 'Left it 72 hours'}[x.why] || ''} · ${score(x)}`,
    `<button type="button" class="pk-res ${x.result === 'w' ? 'is-w' : x.result === 'l' ? 'is-l' : ''}" data-dy-go="${x.mid}">${x.result === 'w' ? 'Won' : x.result === 'l' ? 'Lost' : 'Draw'}</button>`));
  return h;
}
function rankHTML() {
  const rows = D.others(undefined, {withMe: true});
  return `<button type="button" class="pk-backrow" data-dy-bv="">${ui.icon('chevron-left', {size: 16})} Battle</button>`
    + (rows.length ? `<ol class="pk-list pk-rank">${rows.map((r, i) => `<li class="${r.me ? 'is-me' : ''}"><span class="pk-rk">${i + 1}</span>`
      + `${r.member ? ui.avatar(r.member, {size: 32, you: r.me}) : ui.nickAvatar(r.name, {size: 32, you: r.me})}`
      + `<span class="pk-row-t"><b>${esc(r.me ? `${r.team} (you)` : r.team)}</b><small>${esc(r.name)}${r.guest ? ' · Guest' : ''} · ${r.rec.w}–${r.rec.l} · ${nf(r.cards)} cards</small></span>`
      + `<span class="pk-tro">${MODE_IC.rank}<b>${nf(r.tr)}</b></span></li>`).join('')}</ol>` : ui.empty({icon: 'trophy', title: 'No rankings yet', body: 'Win battles to climb.'}));
}
function guideSheet() {
  const body = `<ol class="pk-guide">`
    + `<li><b>Build a deck</b>20 cards: players and Trainers, at most 2 of any one, with at least one Basic player.</li>`
    + `<li><b>Set up</b>Start with 5 cards. Put a Basic player out as your active player and up to 3 on your bench.</li>`
    + `<li><b>Each turn</b>Draw a card. Take the energy from your Energy Zone (you see the next one coming) and attach it to a player. Put Basics on your bench, evolve, play Items (as many as you like), one Supporter and a Stadium, and switch out your active player once.</li>`
    + `<li><b>Attack</b>An attack needs its energy on your active player. Attacking ends your turn. Hitting a weakness does +20: Air beats Blitz, Blitz beats Ground, Ground beats Coverage, Coverage beats Air.</li>`
    + `<li><b>Win</b>Knock out a player for a point (a Legend or Prime ex for two). Three points wins.</li>`
    + `<li><b>Take your time</b>Battles go in turns: play yours when you like, and your opponent gets YOUR MOVE on their Dynasty case.</li></ol>`;
  ui.openSheet({title: 'Guide', body, cls: 'pk-sheet', detents: ['large']});
}
function battleHTML2(st) { return st.bv === 'versus' ? versusHTML(st) : st.bv === 'rank' ? rankHTML() : battleHome(st); }

// ---------------------------------------------------------------------------------------------------- opening a pack
function openHere(st) {
  const s = D.mine(), kind = st.pack, P = D.PACKS[kind];
  if (kind === D.DAILY_PACK && D.dailyReady(s) && !s.pk[kind]) { D.claimDaily(); openPack(st, kind); return; }
  if (s.pk[kind] > 0) { openPack(st, kind); return; }
  if (D.balance(s) < P.price) { ui.toast(`You need ${nf(P.price - D.balance(s))} more coins. Play the Daily Games to earn them.`, {icon: 'info'}); return; }
  ui.actionSheet({title: `Open a ${P.name}?`, message: `${nf(P.price)} coins. You have ${nf(D.balance(s))}.`, cls: 'pk-sheet', actions: [{label: `Open for ${nf(P.price)}`, role: 'primary', value: 'y'}]}).then(v => {
    if (v !== 'y') return;
    const r = D.buy(kind);
    if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
    openPack(st, kind);
  });
}
function openPack(st, kind, team = null) {
  if (D.PACKS[kind].team && !team) { teamPicker(t => openPack(st, kind, t)); return; }
  const r = D.open(kind, {team});
  if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
  refresh(st);
  // (the best last, as Pocket reveals: a Trainer card first)
  const order = r.cards.map(D.anyCard).map((c, i) => ({c, i})).sort((a, b) => (a.c.o || 0) - (b.c.o || 0)).map(x => x.c);
  const ov = document.createElement('div');
  ov.className = 'pk-open';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `Opening a ${D.PACKS[kind].name}`);
  ov.innerHTML = `<div class="pk-open-bg" style="--pc:${D.PACKS[kind].color}"></div>`
    + `<div class="dy-open-pack" data-dy-tear tabindex="0" role="button" aria-label="Rip the pack open: swipe across its top, or press Enter">`
    + `<div class="dy-rip" style="--p:0;--dir:1"><div class="dy-rip-body" style="clip-path:${TEAR.body}">${packHTML(kind, {big: true})}</div>`
    + `<div class="dy-rip-top" style="clip-path:${TEAR.top}">${packHTML(kind, {big: true})}</div>`
    + `<span class="dy-rip-line" aria-hidden="true"></span><span class="dy-rip-hint" aria-hidden="true"><i class="dy-rip-trail"></i><i class="dy-rip-finger"></i></span></div>`
    + `<p class="dy-rip-say">Swipe across the top to rip it open</p></div>`
    + `<div class="pk-deal" hidden><div class="pk-deal-stack" aria-live="polite"></div><p class="pk-deal-n"></p></div>`
    + `<div class="pk-results" hidden><h2>Results</h2><div class="pk-grid is-results">${order.map(c => `<div class="pk-res-c">${anyHTML(c.id, {size: 's', tag: false, noCount: true})}`
      + `${r.dup[c.id] ? '' : '<span class="pk-c-new">NEW</span>'}</div>`).join('')}</div><p class="pk-note">+${D.PP_PER_PACK} pack points</p></div>`
    + `<div class="pk-open-bar" hidden><button type="button" class="pk-pill" data-dy-skip>Skip</button><button type="button" class="pk-open" data-dy-next>Next</button></div>`;
  document.body.appendChild(ov);
  const prevFocus = document.activeElement;
  requestAnimationFrame(() => ov.classList.add('is-in'));
  ov.querySelector('[data-dy-tear]').focus();
  // ---- the cards, one at a time (a ★ or crown card shines first), then the results
  let at = -1;
  const stack = ov.querySelector('.pk-deal-stack'), nTxt = ov.querySelector('.pk-deal-n'), bar = ov.querySelector('.pk-open-bar');
  const showResults = () => {
    at = order.length;
    ov.querySelector('.pk-deal').hidden = true; ov.querySelector('.pk-results').hidden = false;
    ov.querySelector('[data-dy-skip]').hidden = true; ov.querySelector('[data-dy-next]').textContent = 'Done';
    ov.querySelector('[data-dy-next]').focus();
  };
  const next = () => {
    if (at >= order.length) { close(); return; }
    if (at === order.length - 1) { showResults(); return; }
    at++;
    const c = order[at], m = D.markOf(c), rare = m.kind !== 'd';
    const old = stack.querySelector('.pk-deal-c:not(.is-gone)');
    if (old) { old.classList.add('is-gone'); setTimeout(() => old.remove(), RM() ? 0 : 420); }
    stack.insertAdjacentHTML('beforeend', `<div class="pk-deal-c${rare ? ' is-rare' : ''}${m.kind === 'c' ? ' is-crown' : ''}">${anyHTML(c.id, {size: 'l', tag: false, noCount: true})}`
      + `${r.dup[c.id] ? '' : '<span class="pk-c-new is-big">NEW</span>'}</div>`);
    nTxt.textContent = `${at + 1} of ${order.length}`;
    if (rare) { ui.haptic('success'); if (m.kind === 'c' || m.n > 1) { try { ui.confetti(stack.getBoundingClientRect(), {colors: ['#FFD94A', '#6DD3F5', '#F27BB8', '#FFFFFF'], count: 60}); } catch (_) {} } }
    else ui.haptic('light');
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
      setTimeout(() => { pk.hidden = true; ov.querySelector('.pk-deal').hidden = false; bar.hidden = false; next(); ov.querySelector('[data-dy-next]').focus(); }, RM() ? 0 : 560);
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
    const rr = rip.getBoundingClientRect();
    drag = {x: e.clientX, w: rr.width, moved: false, lx: e.clientX, lt: performance.now(), v: 0, tick: 0};
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
  const letGo = () => {
    if (!drag || ripped) return;
    const d = drag;
    drag = null; pk.classList.remove('is-drag');
    if (!d.moved) { nudge(); return; }
    // (far enough across, or a quick flick past a quarter: it rips; short of it, the strip springs back)
    if (prog >= 0.55 || (prog >= 0.25 && d.v > 0.7)) tear();
    else tween(0, 240, () => pk.classList.remove('is-touched')); // (and the hint comes back)
  };
  pk.addEventListener('pointerup', letGo);
  pk.addEventListener('pointercancel', letGo);
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
    if (e.target.closest('[data-dy-skip]')) { showResults(); return; }
    if (e.target.closest('[data-dy-next]') || e.target.closest('.pk-deal')) next();
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
  const body = `<div class="pk-teams">${teams.map(t => `<button type="button" class="pk-teamb" data-dy-team="${t.abbr}" style="--tp:${t.pri}"><img src="${esc(logoUrl(t.abbr, 72))}" alt="" loading="lazy" onerror="this.remove()"><span>${esc(t.name)}</span></button>`).join('')}</div>`;
  const sh = ui.openSheet({title: 'Pick a team', body, cls: 'pk-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-dy-team]');
    if (b) { sh.close(); setTimeout(() => done(b.dataset.dyTeam), 280); }
  });
}

// ---------------------------------------------------------------------------------------------------- the screen
const PANES = {packs: packsHTML, cards: cardsHTML, decks: decksHTML, battle: battleHTML2};
// While you're playing, the app's menu at the foot of the screen goes (the owner, Oct 28 2026: "Remove the menu at the
// bottom of the screen when the user is actively playing in the game"), as Keepfall's does; the header's back button
// leaves. (A battle covers the menu already.)
function fullScreen(st, on) {
  document.documentElement.classList.toggle('is-dynasty-playing', !!on && !st.dead && D.mayPlay());
}
function refresh(st) {
  if (st.dead) return;
  const el = st.el;
  // (Evan's and Ryan Stewart's alone, Oct 28 2026: a profile switched while it's open leaves it)
  if (!D.mayPlay()) { fullScreen(st, false); el.querySelector('[data-dy-pane]').innerHTML = ''; if (!st.left) { st.left = true; st.ctx.back(); } return; }
  if (D.status !== 'ready') {
    el.querySelector('[data-dy-pane]').innerHTML = D.status === 'error' ? ui.empty({icon: 'info', title: 'The cards didn’t load', body: 'Check your connection.', action: {label: 'Try again', kind: 'primary', attrs: {'data-dy-retry': ''}}}) : ui.skeleton('rows', 4, {label: 'Loading the cards'});
    return;
  }
  const s = D.mine();
  el.querySelector('[data-dy-wallet]').innerHTML = coinHTML(D.balance(s));
  el.querySelector('[data-pk-title]').textContent = TABS.find(t => t.id === st.tab).title;
  el.querySelectorAll('.pk-tab').forEach(b => { const on = b.dataset.dyTab === st.tab; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  const dot = el.querySelector('.pk-tab[data-dy-tab="battle"] .pk-dot');
  if (dot) dot.hidden = !MT.waiting();
  const pane = el.querySelector('[data-dy-pane]');
  const keep = pane.querySelector('input[name="dy-q"]') === document.activeElement;
  if (keep && st.tab === 'cards') { drawGrid(st); return; }
  pane.innerHTML = PANES[st.tab](st);
  ui.hydrate(pane);
  if (st.tab === 'cards' && st.f.view !== 'cols') drawGrid(st);
}
function go(st, tab) {
  st.tab = tab;
  if (tab === 'battle') st.bv = '';
  refresh(st);
  st.ctx.screen.scrollTop = 0;
}

export default {
  id: 'dynasty',
  chrome: 'none',
  title: 'Dynasty',

  render() { return shellHTML(); },

  mount(el, ctx) {
    const st = {el, ctx, tab: 'packs', pack: D.DAILY_PACK, bv: '', f: {view: 'mine', ser: '', pos: '', rar: '', q: ''}, shown: PAGE, dead: false, stops: []};
    ST.set(ctx, st);
    fullScreen(st, ctx.visible);
    ctx.setBackTitle('Dynasty');
    el.addEventListener('input', e => {
      if (e.target.name === 'dy-q') { st.f.q = e.target.value; clearTimeout(st.qT); st.qT = setTimeout(() => drawGrid(st), 160); }
    });
    el.addEventListener('click', e => {
      const t = e.target;
      const q = sel => t.closest(sel);
      let b;
      if (q('[data-dy-exit]')) { ui.confirmExit({game: 'Gridiron Dynasty', cls: 'pk-sheet'}).then(home => { if (home && !st.dead) ctx.back(); }); return; }
      if (q('[data-dy-retry]')) { D.load().then(() => refresh(st), () => refresh(st)); refresh(st); return; }
      if ((b = q('[data-dy-tab]'))) { go(st, b.dataset.dyTab); return; }
      if ((b = q('[data-dy-goto]'))) { st.f.view = 'cols'; go(st, 'cards'); return; }
      if ((b = q('[data-dy-cv]'))) { st.f.view = b.dataset.dyCv; refresh(st); return; }
      if (q('[data-dy-all]')) { st.f.view = st.f.view === 'all' ? 'mine' : 'all'; ui.haptic('selection'); refresh(st); return; }
      if (q('[data-dy-filter]')) { filterSheet(st); return; }
      if (q('[data-dy-openhere]')) { openHere(st); return; }
      if (q('[data-dy-packs]')) { packsSheet(st); return; }
      if (q('[data-dy-points]')) { pointsSheet(st); return; }
      if (q('[data-dy-earn]')) { earnSheet(); return; }
      if ((b = q('[data-dy-odds]'))) { oddsSheet(b.dataset.dyOdds); return; }
      if ((b = q('[data-dy-bv]'))) { st.bv = b.dataset.dyBv; refresh(st); ctx.screen.scrollTop = 0; return; }
      if (q('[data-dy-guide]')) { guideSheet(); return; }
      if ((b = q('[data-dy-card]'))) { cardSheet(st, b.dataset.dyCard); return; }
      if (q('[data-dy-more]')) { drawGrid(st, true); return; }
      if (q('[data-dy-spares]')) {
        const sp = D.spares();
        ui.actionSheet({title: 'Quick sell your spares?', cls: 'pk-sheet', message: `Every copy beyond the ones you keep of ${sp.list.length} card${sp.list.length === 1 ? '' : 's'}, for ${nf(sp.coins)} coins.`,
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
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') { if (D.status === 'ready' && D.mayPlay()) { D.sync(); D.earned(D.mine(), true); } if (st.tab === 'battle' || st.tab === 'packs') refresh(st); } }));
    st.stops.push(data.subscribe(type => { if (type === 'me') refresh(st); }));
    st.stops.push(ctx.timer(() => { if (D.status === 'ready' && D.mayPlay()) { const w = el.querySelector('[data-dy-wallet]'); if (w) w.innerHTML = coinHTML(D.balance(D.mine())); } }, 15000));
    try { ui.lsSet('gg-dynasty-seen', '1'); } catch (_) {}
    D.load().then(() => refresh(st), () => refresh(st));
    D.loadGames().then(() => { if (D.status === 'ready' && D.mayPlay()) { D.earned(D.mine(), true); refresh(st); } });
    refresh(st);
  },

  // (back from a battle: the matches as they stand now)
  onShow(ctx) { const st = ST.get(ctx); if (st) { fullScreen(st, true); refresh(st); } },

  onHide(ctx) { const st = ST.get(ctx); if (st) fullScreen(st, false); },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    fullScreen(st, false);
    st.dead = true;
    st.stops.forEach(f => { try { f(); } catch (_) {} });
    D.flush(); MT.flush();
    ST.delete(ctx);
  }
};
