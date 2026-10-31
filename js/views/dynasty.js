// Gridiron Rivals (legacy route/save identifiers remain dynasty). The four labeled tabs are
// Play, Cards, Decks and Packs. Play opens first with a resume/solo action and the active deck.
// The header menu holds settings/rules; the title screen and pack-opening flow remain available.
// cardHTML/trainerHTML render collectible faces; the battle view renders compact game pieces.
// Real printed trading cards stay in the card detail gallery. Match rules are versioned so old
// turns replay unchanged while new matches use signature energy costs and predictable Juke.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';
import * as D from '../core/dynasty.js';
import * as B from '../core/dynasty-battle.js';
import * as MT from '../core/dynasty-match.js';
import * as SOLO from '../core/dynasty-solo.js';
import {profileKey} from '../core/realm-active.js';
import {packHTML, designsOf} from './dynasty-packs.js';
import {openScene} from './dynasty-open.js';
import {bindCardFoil} from './dynasty-foil.js';
import {realCards, realUrl, realName} from '../core/dynasty-real.js';

const esc = data.esc, nf = n => data.nf(n);
const ST = new WeakMap();
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------------------------------- pictures
export const headUrl = (h, w = 300) => {
  const s = String(h || '');
  if (!s) return '';
  // (a Legend's Topps card picture, from the owner's gallery: the whole URL)
  if (/^https?:\/\//.test(s)) return s;
  if (s.startsWith('n:')) return `https://static.www.nfl.com/image/upload/f_auto,q_auto,w_${w}/league/${encodeURIComponent(s.slice(2))}`;
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${s.replace(/[^0-9]/g, '')}.png&w=${w}&h=${Math.round(w * 436 / 600)}`;
};
// (a real card that won't load gives way to the headshot it carries, else to the window beneath: a Legend's number)
const REAL_FAIL = "if(this.dataset.alt){this.className='pk-c-ph';this.src=this.dataset.alt;this.removeAttribute('data-alt')}else this.remove()";
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
  // Portraits give every series one clear visual language. Original printed trading cards remain in realHTML.
  // Some legacy head values are complete card scans; use a jersey number instead of framing those twice.
  const head = c.head && !/^https?:/.test(c.head) ? headUrl(c.head, o.size === 'l' ? 520 : 300) : '';
  const photo = head ? `<img class="pk-c-ph" src="${esc(head)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : '';
  const rarity = String(c.r || 'common');
  const label = `${c.name}, ${S.name}, ${rarity}, ${D.POS_NAME[c.pos] || c.pos}, overall ${c.o}, ${st.hp} HP, ${B.TYPES[st.type].name}${st.stage ? ', evolves from Basic' : ', Basic'}${st.ex ? ', worth 2 points when knocked out' : ''}${o.count > 1 ? `, ${o.count} copies` : ''}${o.ghost ? ', not in your collection' : ''}`;
  const atk = st.attacks.map((a, n) => `<span class="pk-c-atk"><span class="pk-c-cost">${a.cost.map(pipHTML).join('')}</span><b>${esc(a.name)}</b><em>${a.dmg}${['coin', 'qb', 'vs', 'finish'].includes(a.fx) ? '+' : ''}</em></span>`
    + (n === 1 ? `<span class="pk-c-fx">${esc([B.fxText(a), B.signatureText({v: o.rulesVersion || B.RULES_VERSION}, n)].filter(Boolean).join(' '))}</span>` : '')).join('');
  const ability = st.ability ? `<span class="pk-c-ab"><i>Ability</i><b>${esc(B.ABILITY[st.ability].name)}</b></span>` : '';
  const finish = rarity !== 'common' ? '<span class="pk-c-foil" aria-hidden="true"></span><span class="pk-c-glint" aria-hidden="true"></span>' : '';
  const inner = `<span class="pk-c-face" aria-hidden="true">`
    + `<span class="pk-c-head"><span class="pk-c-stage">${st.stage ? 'UPGRADE' : 'BASIC'}</span><b class="pk-c-name">${esc(c.name)}</b><span class="pk-c-hp"><small>HP</small><b>${st.hp}</b>${typeHTML(st.type)}</span></span>`
    + `<span class="pk-c-art"><span class="pk-c-scenery"></span><span class="pk-c-num">${esc(String(c.num || c.pos))}</span>${photo}<span class="pk-c-art-team">${esc(c.team)}</span></span>`
    + `<span class="pk-c-strip">${esc(c.pos)} · ${esc(T.name)} · ${esc(S.short)}</span>`
    + `<span class="pk-c-body${st.ability ? ' has-ability' : ''}">${ability}${atk}</span>`
    + `<span class="pk-c-foot"><span><small>weakness</small>${st.weak ? `${typeHTML(st.weak)}<b>+${B.WEAK_BONUS}</b>` : '<b>—</b>'}</span><span><small>retreat</small>${st.retreat ? Array.from({length: st.retreat}, () => pipHTML('*')).join('') : '<b>free</b>'}</span></span>`
    + `<span class="pk-c-meta"><span class="pk-c-rar is-${m.kind}">${esc(rarity)}</span><span class="pk-c-ovr"><b>${c.o}</b><small>OVR</small></span>${st.ex ? '<span class="pk-c-set">2 PT</span>' : ''}`
    + (o.isNew ? '<span class="pk-c-new">NEW</span>' : '')
    + (o.count > 0 && !o.noCount ? `<span class="pk-c-cnt">${o.count}</span>` : '') + `</span>${finish}</span>`;
  const cls = `pk-card pk-rivals-card t-${st.type} m-${m.kind}${m.n}${m.full ? ' is-full' : ''} r-${rarity} s-${c.s} sz-${o.size || 'm'}${st.ex ? ' is-ex' : ''}${o.ghost ? ' is-ghost' : ''}${o.cls ? ' ' + o.cls : ''}`;
  const style = `--tp:${T.pri};--ts:${T.sec};--type-color:${B.TYPES[st.type].color}`;
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
  const rarity = D.RARITY.includes(t.r) ? t.r : 'common';
  const finish = rarity !== 'common' ? '<span class="pk-c-foil" aria-hidden="true"></span><span class="pk-c-glint" aria-hidden="true"></span>' : '';
  const kind = t.kind === 'coach' ? 'Coach' : TRAINER_KIND[t.kind];
  const label = `${t.name}, ${kind} card. ${t.text}${o.count > 1 ? `, ${o.count} copies` : ''}${o.ghost ? ', not in your collection' : ''}`;
  const inner = `<span class="pk-c-face" aria-hidden="true"><span class="pk-t-head"><b>RIVALS</b><i>${kind}</i></span>`
    + `<span class="pk-t-art">${TRAINER_ART[t.kind] || ''}${T ? `<img class="pk-t-logo" src="${esc(logoUrl(t.team, 96))}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : ''}</span>`
    + `<b class="pk-t-name">${esc(t.name)}</b><span class="pk-t-text">${esc(t.text)}</span>`
    + `<span class="pk-c-meta"><span class="pk-c-rar is-d">${esc(rarity)}</span><span class="pk-c-set">${kind}</span>`
    + (o.isNew ? '<span class="pk-c-new">NEW</span>' : '')
    + (o.count > 0 && !o.noCount ? `<span class="pk-c-cnt">${o.count}</span>` : '') + `</span>${finish}</span>`;
  const cls = `pk-card pk-rivals-card pk-trainer r-${rarity} k-${t.kind} m-d${m.n} sz-${o.size || 'm'}${o.ghost ? ' is-ghost' : ''}${o.cls ? ' ' + o.cls : ''}`;
  const style = T ? `--tp:${T.pri};--ts:${T.sec}` : '';
  return o.tag === false ? `<div class="${cls}" style="${style}" role="img" aria-label="${esc(label)}">${inner}</div>`
    : `<button type="button" class="${cls}" style="${style}" data-dy-card="${esc(t.id)}" aria-label="${esc(label)}">${inner}</button>`;
}
/** A card you don't have yet, face down: no name, picture or stats, just a lock (a collection's missing cards). */
export const lockedHTML = (o = {}) => `<div class="pk-card pk-locked sz-${o.size || 'm'}" role="img" aria-label="A card not in your collection yet"><span class="pk-l-face" aria-hidden="true">${ui.icon('lock')}</span></div>`;
/** Any card by id: a player's or a Trainer card. */
export const anyHTML = (id, o = {}) => (D.card(id) ? cardHTML(D.card(id), o) : trainerHTML(D.trainer(id), o));
/** A card's battle side in words: type, HP, weakness and retreat, its Ability, its attacks. */
export function battleHTML(id, game = {v: B.RULES_VERSION}) {
  const t = D.trainer(id);
  if (t) return `<div class="pk-info"><p class="pk-info-k">${TRAINER_KIND[t.kind]} · ${TRAINER_RULE[t.kind]}</p><p>${esc(t.text)}</p></div>`;
  const st = B.stats(id), c = D.card(id);
  if (!st) return '';
  const T = B.TYPES[st.type];
  const ab = st.ability ? `<div class="pk-ab"><b>Ability · ${esc(B.ABILITY[st.ability].name)}</b><span>${esc(B.abilityText(st.ability, game.v))}</span></div>` : '';
  const atk = st.attacks.map((a, n) => `<li><span class="pk-cost">${a.cost.map(pipHTML).join('')}</span><span class="pk-an"><b>${esc(a.name)}</b>`
    + `${B.fxText(a) ? `<small>${esc(B.fxText(a))}</small>` : ''}${a.note ? `<small>${esc(a.note)}</small>` : ''}${a.flat ? '<small>Ignores weakness.</small>' : ''}${B.signatureText(game, n) ? `<small class="pk-signature-note">${esc(B.signatureText(game, n))}</small>` : ''}</span><em>${a.dmg}</em></li>`).join('');
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
  if (c.s === 'X') lines.push(['Career', c.ln[0]], ['First Topps card', c.ln[1]]);
  else if (c.s === 'G') lines.push([c.t, c.ln[0]]);
  else if (c.s === 'A') lines.push([c.t, c.ln[0]], ['2025 season', c.ln[1]]);
  else { if (c.ln[0]) lines.push([`${D.DATA.season} so far`, c.ln[0]]); if (c.ln[1]) lines.push([`${D.DATA.season - 1} season`, c.ln[1]]); }
  const facts = [D.POS_NAME[c.pos], c.s === 'X' ? `Legend of the ${T.name}` : T.name, c.college ? c.college : '', c.exp ? `${c.exp} yr${c.exp === 1 ? '' : 's'} pro` : c.s === 'X' ? '' : 'Rookie']
    .filter(Boolean).join(' · ');
  return `<div class="pk-info"><p class="pk-info-k">${esc(D.SERIES[c.s].name)} · OVR ${c.o}</p><p>${esc(facts)}</p><ul class="pk-attrs">${bars}</ul>`
    + (lines.length ? `<dl class="pk-lines">${lines.filter(l => l[1]).map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '') + '</div>';
}
/** A player's real trading cards, the one on this card marked (core/dynasty-real.js), for his card up close. */
export function realHTML(c) {
  const list = realCards(c.p), on = c.real;
  if (!list.length) return '';
  return `<section class="pk-real"><h3 class="pk-h">${esc(c.name)}’s real cards</h3><div class="pk-real-row" data-hscroll>${list.map(r => `<figure class="pk-real-c${r === on ? ' is-on' : ''}">`
    + `<img src="${esc(realUrl(c.p, r))}" alt="${esc(`${c.name}, ${realName(r)}`)}" width="160" height="225" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">`
    + `<figcaption>${esc(realName(r))}${r === on ? '<b>On this card</b>' : ''}</figcaption></figure>`).join('')}</div></section>`;
}
/** A card up close: the card, its battle side, its back, and what you can do with it. */
function cardSheet(st, id) {
  const c = D.anyCard(id);
  if (!c) return;
  const s = D.mine(), n = s.o[id] || 0, inDeck = s.dk.filter(x => x === id).length;
  if (D.isNew(id, s)) invalidatePanes(st);
  D.markSeen([id]);
  const acts = [];
  if (n > inDeck && s.dk.length < B.DECK_SIZE) acts.push(ui.button({label: 'Add to my deck', kind: 'primary', block: true, attrs: {'data-dy-add': id}}));
  if (inDeck) acts.push(ui.button({label: 'Take out of my deck', kind: 'secondary', block: true, attrs: {'data-dy-rm': id}}));
  if (n > inDeck) acts.push(ui.button({label: `Quick sell for ${nf(D.sellValue(c))} coins`, kind: 'secondary', block: true, attrs: {'data-dy-sell': id}}));
  if (!n && D.ppCost(c)) acts.push(ui.button({label: `Get it for ${nf(D.ppCost(c))} pack points`, kind: s.pp >= D.ppCost(c) ? 'primary' : 'secondary', block: true, attrs: {'data-dy-pp': id}, disabled: s.pp < D.ppCost(c)}));
  const body = `<div class="pk-zoom">${anyHTML(id, {size: 'l', tag: false, ghost: !n, noCount: true})}</div>`
    + `<p class="pk-own">${n ? `${n} in your collection${inDeck ? ` · ${inDeck} in your deck` : ''}` : 'Not in your collection yet'}</p>`
    + (acts.length ? `<div class="pk-acts">${acts.join('')}</div>` : '') + battleHTML(id) + (D.card(id) ? backHTML(c) + realHTML(c) : '');
  let stopFoil = () => {};
  const sh = ui.openSheet({title: 'Card details', body, cls: 'pk-sheet', detents: ['large'], onClose: () => stopFoil()});
  stopFoil = bindCardFoil(sh.body);
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

/** The best cards a pack can give (its preview, above the pack). */
function packBest(kind, n = 5) {
  const pools = {std: c => c.s === 'L', team: c => c.s === 'L', prem: c => c.s === 'L' || c.s === 'R' || c.s === 'G', gday: c => c.s === 'G', leg: c => c.s === 'X' || c.s === 'P'};
  const f = pools[kind] || pools.std;
  return D.CARDS.filter(f).sort((a, b) => b.o - a.o).slice(0, n);
}

// ---------------------------------------------------------------------------------------------------- the header and tabs
// Four labeled destinations; utility actions live in the header menu. The legacy pane IDs stay stable.
const TABS = [
  {id: 'battle', label: 'Play', title: 'Play', ic: '<path d="m9 5 11 7-11 7z" fill="currentColor"/>'},
  {id: 'cards', label: 'Cards', title: 'My Cards', ic: '<rect x="6" y="3" width="13" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 7v13" stroke="currentColor" stroke-width="1.8"/>'},
  {id: 'decks', label: 'Decks', title: 'Decks', ic: '<path d="M4 8h16v12H4zM7 4h10v4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 13h6M9 16h4" stroke="currentColor" stroke-width="1.8"/>'},
  {id: 'packs', label: 'Packs', title: 'Packs', ic: '<path d="M6 3h12v18H6zM6 7h12M6 17h12" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m12 9 2 3-2 3-2-3z" fill="currentColor"/>'}
];
const PANE_TABS = TABS;
export function shellHTML() {
  return `<div class="pk" data-dy><header class="pk-hdr">${ui.exitButton('data-dy-exit', 'Exit Gridiron Rivals')}`
    + `<div class="rh-brand"><span>GRIDIRON RIVALS</span><h1 class="pk-title" data-pk-title tabindex="-1">Play</h1></div><span class="pk-hud" data-dy-hud></span>`
    + `<button type="button" class="rh-menu" data-dy-menu aria-label="Menu">${ui.icon('list', {size: 22})}</button></header>`
    + `<div class="pk-pane" data-dy-pane></div>`
    + `<nav class="pk-nav" aria-label="Gridiron Rivals">${TABS.map((t, i) => `<button type="button" class="pk-tab${i === 0 ? ' is-on' : ''}" data-dy-tab="${t.id}" aria-pressed="${i === 0}">`
      + `<svg viewBox="0 0 24 24" aria-hidden="true">${t.ic}</svg><span class="rh-tab-label">${t.label}</span><i class="pk-dot" hidden></i></button>`).join('')}</nav>`
    + startHTML() + '</div>';
}
/** The header's counters: packs to open (tap for the pack list) and coins. */
function hudHTML(s) {
  const inf = D.unlimited(), n = Object.keys(s.pk).filter(k => D.PACKS[k]).reduce((t, k) => t + (s.pk[k] || 0), 0);
  return `<button type="button" class="pk-meter${inf ? ' is-max' : ''}" data-dy-packs aria-label="${inf ? 'Unlimited packs to open' : `${n} pack${n === 1 ? '' : 's'} to open`}: select a booster pack">`
    + `<i class="pk-meter-p"></i><i class="pk-meter-p"></i><b>${inf ? '∞' : nf(n)}</b>${inf ? '<small>MAX</small>' : ''}</button>` + coinHTML(D.balance(s));
}
// Pocket's bookmark (the collections) and the open-pack glyph on the round Open
const SIDE_IC = {
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z" fill="currentColor"/><path d="M12 7.2l1.2 2.5 2.7.3-2 1.9.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.9 2.7-.3z" fill="#fff"/></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8.5h12V21H6z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M6 8.5l1.5-4h9l1.5 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 18v-6M9.5 14.5l2.5-2.5 2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

// ---------------------------------------------------------------------------------------------------- Packs
const untilMidnight = () => { const d = new Date(), m = new Date(d); m.setHours(24, 0, 0, 0); return m - d; };
function packsHTML(st) {
  const s = D.mine();
  // (the Starter Pack first while it waits; once opened, back to the Standard Pack)
  if (s.pk.start && !st.startShown) { st.pack = 'start'; st.startShown = true; }
  if (!D.PACKS[st.pack] || (D.PACKS[st.pack].starter && !s.pk[st.pack])) st.pack = D.DAILY_PACK;
  const kind = st.pack, P = D.PACKS[kind], have = s.pk[kind] || 0, free = D.dailyReady(s) && kind === D.DAILY_PACK;
  const wait = waitingOf(st), ready = D.claimable(s);
  const best = packBest(kind);
  const slots = P.slots.reduce((t, x) => t + x.n, 0);
  const inf = D.unlimited();
  const open = inf ? 'Open' : free ? 'Open free pack' : have ? `Open${have > 1 ? ` (${have})` : ''}` : `Open · ${nf(P.price)}`;
  const note = kind === 'start' ? '1 Epic or better guaranteed' : kind === 'prem' ? '1 Legendary or better guaranteed' : kind === 'gday' ? '1 Gameday card guaranteed' : kind === 'leg' ? '1 card 90+ guaranteed' : '1 Trainer card in every pack';
  // (Pocket's clock pill over the showcase: when this pack is yours; and its tags beside the pack: what it is, its
  // count, its guarantee, what it costs you)
  const clock = kind === 'start' ? 'Open it once' : kind === 'std' ? (free ? 'Free pack until 11:59 p.m.' : inf ? 'Open as many as you like' : `Next free pack in ${ui.untilText(untilMidnight())}`)
    : kind === 'gday' ? `Week ${D.lastWeek()}’s Gameday cards` : kind === 'team' ? 'Any team you pick' : kind === 'prem' ? 'Legendary or better inside' : 'Legends and Prime stars';
  const cost = inf ? 'Unlimited' : free ? 'Free today' : have ? `${have} to open` : `${nf(P.price)} coins`;
  let h = `<div class="pk-packs" style="--pc:${P.color}">`;
  if (wait) h += `<button type="button" class="pk-alert" data-dy-tab="battle">${ui.icon('versus', {size: 20})}<span>${wait === 1 ? 'A battle is' : `${wait} battles are`} waiting on you</span>${ui.icon('chevron-right', {size: 16})}</button>`;
  if (ready.length) h += `<button type="button" class="pk-alert is-gold" data-dy-goto="cols">${ui.icon('trophy', {size: 20})}<span>${ready.length === 1 ? 'A collection is' : `${ready.length} collections are`} complete: claim your reward</span>${ui.icon('chevron-right', {size: 16})}</button>`;
  // (unlimited packs, Evan's and Ryan Stewart's: Oct 29 2026; beside it Pocket's bookmark, the collections, and the ?)
  h += `<div class="pk-free"><span class="pk-free-b${inf || D.dailyReady(s) ? ' is-ready' : ''}"><i class="pk-free-i"></i><b>${inf ? 'Unlimited packs' : D.dailyReady(s) ? 'Free pack ready' : `Next free pack in ${esc(ui.untilText(untilMidnight()))}`}</b></span>`
    + `<button type="button" class="pk-round" data-dy-goto="cols" aria-label="Collections${ready.length ? ': a reward to claim' : ''}">${SIDE_IC.book}${ready.length ? '<i class="pk-bang">!</i>' : ''}</button>`
    + `<button type="button" class="pk-round" data-dy-earn aria-label="How you earn coins">?</button></div>`;
  // (the pack in its chosen design; the dots under it between two arrows when it has more than one: artTo; behind it,
  // peeking out to the right, the packs that follow it, as Pocket stacks a set's packs: a swipe brings the next to the
  // front, a tap on one brings it: packTo)
  const ds = designsOf(kind), di = artAt(st, kind), many = ds.length > 1, label = `${open}: ${P.name}, ${slots} cards, ${note}`;
  const kinds = packKinds(s), ki = kinds.indexOf(kind), back = kinds.length > 1 ? [1, 2].filter(j => j < kinds.length).map(j => kinds[(ki + j) % kinds.length]) : [];
  const stack = back.map((k, j) => `<button type="button" class="pk-car-bk" data-bk="${j + 1}" data-dy-to="${k}" aria-label="${esc(D.PACKS[k].name)}: bring it to the front">${packHTML(k, {big: true, count: s.pk[k], design: artAt(st, k)})}</button>`).join('');
  h += `<div class="pk-stage"><div class="pk-show"><span class="pk-clock">${ui.icon('clock', {size: 14})}<span>${esc(clock)}</span></span>`
    + `<span class="pk-show-tag">${ui.icon('star', {size: 14})}Top cards in this pack</span>`
    + `<div class="pk-show-row">${best.map(c => cardHTML(c, {size: 's', tag: false, noCount: true})).join('')}</div><i class="pk-show-tip" aria-hidden="true"></i></div>`
    + `<div class="pk-tags" aria-hidden="true"><b>${esc(P.name.replace(/ Pack$/, ''))}</b><span>1 pack contains ${slots} cards</span><span>${esc(note)}</span><span>${esc(cost)}</span></div>`
    + `<div class="pk-car${kinds.length > 1 ? ' is-many' : ''}" data-dy-car>${stack ? `<div class="pk-car-back">${stack}</div>` : ''}<div class="pk-car-move"><button type="button" class="pk-bigpack" data-dy-openhere data-dy-label="${esc(label)}" aria-label="${esc(artLabel(label, ds, di))}">${packHTML(kind, {big: true, count: have, design: di})}</button></div></div>`
    + `<span class="pk-reflect" aria-hidden="true">${packHTML(kind, {big: true, design: di})}</span>`
    + '<span class="sr-only" aria-live="polite" data-dy-packsay></span>'
    + (many ? `<div class="pk-car-dots" role="group" aria-label="Pack designs"><button type="button" class="pk-car-b" data-dy-art="-1" aria-label="Previous pack design">${ui.icon('chevron-left', {size: 16})}</button>`
      + `${ds.map((d, i) => `<button type="button" class="pk-car-dot" data-dy-artat="${i}" aria-label="${esc(d.name)}"${i === di ? ' aria-current="true"' : ''}></button>`).join('')}`
      + `<button type="button" class="pk-car-b" data-dy-art="1" aria-label="Next pack design">${ui.icon('chevron-right', {size: 16})}</button></div>`
      + '<span class="sr-only" aria-live="polite" data-dy-artsay></span>' : '')
    + `<button type="button" class="pk-pts" data-dy-points aria-label="Pack points: ${nf(s.pp)}"><i class="pk-pts-i"></i><b>${nf(s.pp)} pts</b></button></div>`;
  h += `<div class="pk-actions"><button type="button" class="pk-pill" data-dy-odds="${kind}">Offering Rates</button>`
    + `<button type="button" class="pk-open is-round" data-dy-openhere aria-label="${esc(`${open}: ${P.name}`)}">${SIDE_IC.open}<span>Open</span></button>`
    + `<button type="button" class="pk-pill is-r" data-dy-packs>Select other booster packs ${ui.icon('chevron-right', {size: 14})}</button></div>`;
  const lp = s.lp.filter(D.isCard).slice(0, 10);
  if (lp.length) h += `<section class="pk-sec"><h2 class="pk-h">Latest pulls</h2><div class="pk-rail" data-hscroll>${lp.map(id => anyHTML(id, {size: 's', isNew: D.isNew(id, s), noCount: true})).join('')}</div></section>`;
  return h + '</div>';
}
const RAR_SYM = {common: '◆', rare: '◆◆', epic: '◆◆◆', legendary: '◆◆◆◆', mythic: '★'};
function oddsSheet(kind) {
  const P = D.PACKS[kind];
  const pool = {live: 'Live Series', trainer: 'a Trainer card (Supporter, Item or Stadium)', all: 'Live Series, Rookie, Gameday, Prime and Awards', gameday: 'a Gameday card (this week’s three times as likely)', elite: 'Legend 25%, Prime 30%, Award 20%, Gameday 25%, all 90+'};
  const body = D.packOdds(kind).map(g => `<section class="pk-odds"><h3>${g.n === 1 ? '1 card' : `${g.n} cards`}: ${esc(pool[g.pool] || g.pool)}</h3>`
    + `<ul>${g.odds.map(o => `<li><span class="pk-sym">${g.pool === 'trainer' ? (o.r === 'legendary' ? '◆◆◆' : '◆◆') : g.pool === 'elite' || g.pool === 'gameday' ? '★★ ♛' : RAR_SYM[o.r]}</span>${esc(g.pool === 'trainer' ? (o.r === 'legendary' ? 'Legendary' : 'Epic') : D.RARITY_NAME[o.r])}<b>${o.pct}%</b></li>`).join('')}</ul></section>`).join('')
    + `<p class="pk-note">◆ Common: his headshot · A real trading card makes it Rare or better, by OVR: ◆◆ Rare (under ${D.SCALE.epic}) · ◆◆◆ Epic (${D.SCALE.epic}–${D.SCALE.legendary - 1}) · ◆◆◆◆ Legendary (${D.SCALE.legendary}–${D.SCALE.mythic - 1}) · ★ Mythic (${D.SCALE.mythic}+) · ★★ Prime, Gameday and Award cards · ♛ Legends. Every pack also gives 5 pack points.</p>`;
  ui.openSheet({title: 'Offering Rates', body: `<p class="pk-note">${esc(P.name)}</p>` + body, cls: 'pk-sheet', detents: ['fit']});
}
/** The packs on the home, in Pocket's order: the Starter Pack first while it waits, then the rest. */
const packKinds = s => (s.pk.start ? ['start'] : []).concat(D.PACK_ORDER);
/** Brings pack `to` (an index into packKinds, wrapped) to the front of the home's stack, the way it's going (dir: 1 the
 *  next, from behind on the right; -1 the one before, in from the left; the front pack goes the other way); then the
 *  home redraws round it (the showcase, the tags, Open). Under reduced motion it just redraws. */
function packTo(st, to, dir) {
  const s = D.mine(), kinds = packKinds(s), n = kinds.length, car = st.el.querySelector('[data-dy-car]');
  if (!car) return;
  const mv = car.querySelector('.pk-car-move'), rf = st.el.querySelector('.pk-reflect'), rp = rf && rf.firstElementChild;
  const was = mv.style.transform || 'none', rwas = (rp && rp.style.transform) || 'none';
  mv.style.transform = ''; if (rp) rp.style.transform = '';
  car.classList.remove('is-drag');
  [mv, rp].forEach(x => { if (x && x.getAnimations) x.getAnimations().forEach(a => a.cancel()); });
  const i = (to % n + n) % n;
  if (n < 2 || kinds[i] === st.pack) {
    if (!RM() && was !== 'none' && mv.animate) { const o = {duration: 240, easing: 'cubic-bezier(.2,.9,.3,1.2)'}; mv.animate([{transform: was}, {transform: 'none'}], o); if (rp) rp.animate([{transform: rwas}, {transform: 'none'}], o); }
    return;
  }
  st.pack = kinds[i]; ui.haptic('selection');
  const then = () => {
    if (st.dead || st.hidden || st.tab !== 'packs') return;
    refresh(st);
    const say = st.el.querySelector('[data-dy-packsay]'), now = st.el.querySelector('.pk-bigpack');
    if (say) say.textContent = document.activeElement === now ? '' : `${D.PACKS[st.pack].name}, pack ${i + 1} of ${n}`;
  };
  if (RM() || !mv.animate || st.dead) { then(); return; }
  const w = mv.offsetWidth, off = (sg, o) => ({transform: `translateX(${sg * w * .6}px) rotate(${sg * 5}deg)`, opacity: o});
  const bk = Array.from(car.querySelectorAll('.pk-car-bk')), slot = j => getComputedStyle(car).getPropertyValue(`--bk${j}`).trim() || 'none';
  if (rf && rf.getAnimations) rf.getAnimations().forEach(a => a.cancel());
  const ro = rf ? +getComputedStyle(rf).opacity : 0, fade = (a, b, ms) => { if (rf) rf.animate([{opacity: a}, {opacity: b}], {duration: ms}); };
  const ease = 'cubic-bezier(.5,0,.6,1)';
  let out;
  if (dir > 0) {
    // (the front pack leaves to the left; the one behind comes forward to the middle, the one behind it up a place)
    out = mv.animate([{transform: was, opacity: 1}, off(-1, 0)], {duration: 170, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards'});
    bk.forEach((b, j) => b.animate([{transform: slot(j + 1)}, {transform: j ? slot(j) : 'translateX(-50%)'}], {duration: 170, easing: ease, fill: 'forwards'}));
  } else {
    // (the front pack goes back a place; the stack moves back with it, its last fading out)
    out = mv.animate([{transform: was}, {transform: slot(1)}], {duration: 170, easing: ease, fill: 'forwards'});
    bk.forEach((b, j) => b.animate([{transform: slot(j + 1), opacity: 1}, {transform: slot(j + 2), opacity: j + 1 < bk.length ? 1 : 0}], {duration: 170, easing: ease, fill: 'forwards'}));
  }
  fade(ro, 0, 170);
  if (rp && rwas !== 'none') rp.animate([{transform: rwas}, {transform: `translateX(${-dir * w * .6}px)`}], {duration: 170, fill: 'forwards'});
  out.onfinish = () => {
    then();
    if (st.dead || st.hidden || st.tab !== 'packs') return;
    const car2 = st.el.querySelector('[data-dy-car]'), mv2 = car2 && car2.querySelector('.pk-car-move'), rf2 = st.el.querySelector('.pk-reflect');
    if (!mv2) return;
    const w2 = mv2.offsetWidth, bk2 = Array.from(car2.querySelectorAll('.pk-car-bk')), last = bk2[bk2.length - 1];
    if (dir > 0) {
      // (the new front is where the one behind arrived; a new last pack slides in behind from the right)
      if (last) last.animate([{transform: slot(bk2.length + 1), opacity: 0}, {transform: slot(bk2.length), opacity: 1}], {duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.1)'});
    } else {
      mv2.animate([{transform: `translateX(${-w2 * .6}px) rotate(-5deg)`, opacity: 0}, {transform: 'none', opacity: 1}], {duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.1)'});
    }
    if (rf2) rf2.animate([{opacity: 0}, {opacity: ro}], {duration: 320});
  };
}
function packsSheet(st) {
  const s = D.mine();
  const kinds = packKinds(s);
  const body = `<div class="pk-pick">${kinds.map(k => `<button type="button" class="pk-pickb${k === st.pack ? ' is-on' : ''}" data-dy-pick="${k}">${packHTML(k, {count: s.pk[k], design: artAt(st, k)})}`
    + `<span><b>${esc(D.PACKS[k].name)}</b><small>${esc(D.PACKS[k].blurb)}</small><em>${D.unlimited() ? 'Unlimited' : s.pk[k] ? `${s.pk[k]} to open` : `${nf(D.PACKS[k].price)} coins`}</em></span></button>`).join('')}</div>`;
  const sh = ui.openSheet({title: 'Select a booster pack', body, cls: 'pk-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-dy-pick]');
    if (b) { st.pack = b.dataset.dyPick; ui.haptic('selection'); sh.close(); refresh(st); }
  });
}
// A pack's designs, as Pocket's artworks of a pack (views/dynasty-packs.js designsOf; the owner, Oct 29 2026: "Add more
// art designs to the packs"): the arrows either side of the dots under the pack, or a dot, or ← and → on them, flip
// between them (a sideways swipe on the pack switches packs since Oct 29 2026: packTo); the pack list and the opening
// show the one chosen. The choice per pack is this viewer's own (localStorage, by design id): cosmetic, never the save
// or the odds.
const ART_KEY = 'gg-dy-art';
function artLoad() {
  const o = {};
  let j = null;
  try { j = JSON.parse(ui.lsGet(ART_KEY) || 'null'); } catch (_) {}
  if (j && typeof j === 'object') for (const k in D.PACKS) { const i = designsOf(k).findIndex(d => d.id === j[k]); if (i > 0) o[k] = i; }
  return o;
}
function artSave(st) {
  const j = {};
  for (const k in st.art) { const d = designsOf(k)[st.art[k]]; if (d) j[k] = d.id; }
  ui.lsSet(ART_KEY, JSON.stringify(j));
}
const artAt = (st, kind) => { const n = designsOf(kind).length; return ((st.art[kind] || 0) % n + n) % n; };
const artLabel = (base, ds, i) => ds.length > 1 ? `${base}, ${ds[i].name} (design ${i + 1} of ${ds.length})` : base;
/** Shows the home's pack in design `to` (wrapped): the pack slides out the way it's going (dir: 1 to the next, -1 back)
 *  and the new one in from the other side (none under reduced motion). */
function artTo(st, to, dir) {
  const kind = st.pack, ds = designsOf(kind), n = ds.length, car = st.el.querySelector('[data-dy-car]');
  if (!car) return;
  const mv = car.querySelector('.pk-car-move'), big = car.querySelector('.pk-bigpack'), rf = st.el.querySelector('.pk-reflect');
  const rp = rf && rf.firstElementChild, was = mv.style.transform || 'none';
  mv.style.transform = ''; if (rp) rp.style.transform = '';
  [mv, rp].forEach(x => { if (x && x.getAnimations) x.getAnimations().forEach(a => a.cancel()); });
  const i = (to % n + n) % n;
  if (n < 2 || i === artAt(st, kind)) return;
  st.art[kind] = i; artSave(st); ui.haptic('selection');
  const draw = () => {
    const at = artAt(st, kind);
    big.innerHTML = packHTML(kind, {big: true, count: D.mine().pk[kind] || 0, design: at});
    big.setAttribute('aria-label', artLabel(big.dataset.dyLabel || '', ds, at));
    if (rf) rf.innerHTML = packHTML(kind, {big: true, design: at});
    car.parentNode.querySelectorAll('[data-dy-artat]').forEach(b => { if (+b.dataset.dyArtat === at) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    // (said once: the focused big pack's own label says it already)
    const say = car.parentNode.querySelector('[data-dy-artsay]');
    if (say) say.textContent = document.activeElement === big ? '' : `${ds[at].name}, design ${at + 1} of ${n}`;
  };
  if (RM() || !mv.animate) { draw(); return; }
  const w = mv.offsetWidth, off = (s, o) => ({transform: `translateX(${s * w * .6}px) rotate(${s * 5}deg)`, opacity: o});
  if (rf && rf.getAnimations) rf.getAnimations().forEach(a => a.cancel());
  const ro = rf ? +getComputedStyle(rf).opacity : 0, fade = (a, b, ms) => { if (rf) rf.animate([{opacity: a}, {opacity: b}], {duration: ms}); };
  const out = mv.animate([{transform: was, opacity: 1}, off(-dir, 0)], {duration: 150, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards'});
  fade(ro, 0, 150);
  out.onfinish = () => {
    draw(); out.cancel();
    mv.animate([off(dir, 0), {transform: 'none', opacity: 1}], {duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.1)'});
    fade(0, ro, 320);
  };
}
function earnSheet() {
  const s = D.mine(), E = D.earned(s);
  const rows = Object.keys(D.PAY).map(g => `<li><span><b>${esc(D.GAME_NAME[g])}</b><small>${esc(D.PAY_WORDS[g])}</small></span><em>${E.today[g] ? '+' + nf(E.today[g]) : '–'}</em></li>`).join('');
  const body = `<p class="pk-note">Coins open packs. The Daily Games pay them: each game’s first finished result of the day, from the day your Rivals began. You’ve earned ${nf(E.total)} from ${E.days} game${E.days === 1 ? '' : 's'}.</p>`
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
    + `<h3 class="pk-h">Rarity</h3>${ui.chips({name: 'dy-rar', items: [{id: '', label: 'Any'}, ...D.RARITY.slice().reverse().map(r => ({id: r, label: RAR_SYM[r]}))], value: f.rar})}`
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
  if (st.dead || st.hidden || st.tab !== 'cards') return;
  const host = st.el.querySelector('[data-dy-grid]');
  if (!host) return;
  const list = filtered(st), s = D.mine();
  const key = paneKey(st), from = more && st.gridKey === key && host.querySelector('.pk-grid') ? st.shown : 0;
  st.gridKey = key; st.renderedKey = key;
  st.shown = from + PAGE;
  const cards = list.slice(from, st.shown).map(c => anyHTML(c.id, {size: 's', count: s.o[c.id] || 0, ghost: !(s.o[c.id] > 0), isNew: D.isNew(c.id, s)})).join('');
  const next = list.length > st.shown ? `<button type="button" class="pk-more" data-dy-more>Show more (${nf(list.length - st.shown)})</button>` : '';
  if (from) {
    host.querySelector('.pk-grid').insertAdjacentHTML('beforeend', cards);
    const old = host.querySelector('[data-dy-more]'); if (old) old.remove();
    host.insertAdjacentHTML('beforeend', next);
    return;
  }
  host.innerHTML = list.length ? `<div class="pk-grid">${cards}</div>` + next
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
    body += `<p class="pk-note">${(col.kind === 'series' || col.kind === 'week') && col.of < need.length ? `Any ${col.of} of these count.` : 'Every one of these.'}</p><div class="pk-grid">${need.map(id => (s.o[id] > 0 ? anyHTML(id, {size: 's', noCount: true}) : lockedHTML({size: 's'}))).join('')}</div>`;
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
  h += `<section class="rh-strategies"><h2>Find your play style</h2><p>Build from cards you own. Your current deck changes only when you choose a style.</p>${D.STRATEGIES.map(plan => {
    const candidate = D.strategyDeck(plan.id, s.o);
    return `<article class="rh-strategy"><div><h3>${esc(plan.name)}</h3><p>${esc(plan.description)}</p><small>${esc(plan.weakness)}</small></div><button type="button" class="pk-btn is-go" data-dy-strategy="${plan.id}"${candidate.ok ? '' : ' disabled'}>Use deck</button>${candidate.ok ? '' : `<p class="rh-strategy-missing">${esc(candidate.why)}</p>`}</article>`;
  }).join('')}</section>`;
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
// Pocket's Battle screen: the banner (your next Solo ladder game: core/dynasty-solo.js; the owner, Oct 30 2026: "This
// game mode should be focused on games against the cpu getting increasingly difficult"), then the ladder and Versus
// (your matches and challenges), then Rankings, the Guide and Decks.
const ago = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const avatarOf = (o, size = 36) => (o.member ? ui.avatar(o.member, {size}) : ui.nickAvatar(o.name, {size}));
export function battleHome(st, s = D.mine()) {
  const wait = waitingOf(st), cur = SOLO.current(), dk = D.deckOf(s), ready = D.claimable(s).length;
  const move = matchesOf(st).find(x => ['setup', 'yours'].includes(x.state));
  const resume = move || cur;
  const stars = dk.ids.map(id => D.card(id)).filter(Boolean).filter((c, i, a) => a.findIndex(x => x.id === c.id) === i).slice(0, 3);
  const starter = !dk.ok && s.pk.start > 0;
  const at = SOLO.ladderAt(s), next = SOLO.stage(Math.min(at, SOLO.LADDER));
  const action = resume ? `data-dy-go="${resume.mid}"` : dk.ok ? `data-dy-solo="${next.id}"` : starter ? 'data-dy-tab="packs"' : 'data-dy-tab="decks"';
  const label = resume ? 'Continue match' : dk.ok ? `Play game ${next.n}` : starter ? 'Open starter pack' : 'Prepare your deck';
  return `<section class="rh-hero" aria-label="Play Rivals"><div class="rh-kicker"><span class="rh-live"></span> ${at > SOLO.LADDER ? 'LADDER COMPLETE · REPLAY THE FINAL' : `SOLO LADDER · GAME ${next.n} OF ${SOLO.LADDER}`}</div>`
    + `<h2>${esc(next.name)}</h2><p>${resume ? `Your match against ${esc(resume.opp.name)} is waiting.` : `${esc(next.tier.name)}: ${esc(next.tier.blurb)}`}</p>`
    + `<button type="button" class="rh-play" ${action}>${ui.icon('play-fill', {size: 18})}${label}${ui.icon('chevron-right', {size: 18})}</button>`
    + `<span class="rh-hero-note">${resume ? 'Your cards and progress are saved' : starter ? 'Your first pack builds a ready-to-play deck' : 'Each win unlocks the next game · First to three touchdowns'}</span>`
    + `<div class="rh-yard" aria-hidden="true"><span>20</span><span>40</span><span>50</span><span>40</span><span>20</span></div></section>`
    + `<button type="button" class="rh-active-deck" data-dy-tab="decks"><span class="rh-deck-art" aria-hidden="true">${stars.slice(0, 2).map((c, i) => `<span style="--i:${i}">${cardHTML(c, {size: 's', tag: false, noCount: true})}</span>`).join('')}</span>`
    + `<span class="rh-deck-copy"><small>ACTIVE DECK</small><b>${esc(D.teamName(s))}</b><span>${dk.ids.length}/20 cards · ${dk.ok ? 'Ready to play' : esc(dk.why)}</span></span>${ui.icon('chevron-right', {size: 18})}</button>`
    + `<div class="rh-section-head"><h2>Choose your matchup</h2><span>${nf(s.rec.w)} W · ${nf(s.rec.l)} L</span></div>`
    + `<div class="pk-modes"><button type="button" class="pk-mode" data-dy-bv="solo">${MODE_IC.solo}<b>Solo ladder</b><small>${at > SOLO.LADDER ? 'All 30 games won' : `Game ${at} of ${SOLO.LADDER} · ${esc(next.tier.name)}`}</small></button>`
    + `<button type="button" class="pk-mode" data-dy-bv="versus">${MODE_IC.versus}<b>Challenge a friend</b><small>${wait ? `${wait} ${wait === 1 ? 'match needs' : 'matches need'} your attention` : 'Take turns, on your schedule'}</small>${wait ? '<i class="pk-bang">!</i>' : ''}</button></div>`
    + `<details class="rh-how"><summary>Make every card count <span>How to play</span></summary><ol><li><b>Set your lineup.</b> One active player, up to three on the bench.</li><li><b>Tap a card.</b> It lifts up with its plays. Pick one, or put it back.</li><li><b>Energy is automatic.</b> Each turn it goes on your active player (or the bench player who needs it).</li><li><b>Choose your moment.</b> Quick plays keep energy. Signature plays spend one energy for a bigger hit.</li></ol><p>Knockouts score touchdowns. First to three wins. Matches already in progress keep their original rules.</p></details>`
    + `<div class="pk-row-s"><button type="button" class="pk-mini" data-dy-guide>${MODE_IC.guide}<span>Rules</span></button>`
    + `<button type="button" class="pk-mini" data-dy-tab="decks">${TILE.decks}<span>Decks</span></button>`
    + `<button type="button" class="pk-mini" data-dy-bv="rank">${MODE_IC.rank}<span>Rankings</span></button>`
    + `<button type="button" class="pk-mini is-end" data-dy-goto="cols">${MODE_IC.missions}<span>Collections</span>${ready ? '<i class="pk-bang">!</i>' : ''}</button></div>`;
}
const MODE_IC = {
  solo: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="12" width="30" height="24" rx="8" fill="#E8F7FF" stroke="#25A9E0" stroke-width="2.4"/><circle cx="19" cy="24" r="3.2" fill="#25A9E0"/><circle cx="29" cy="24" r="3.2" fill="#25A9E0"/><path d="M24 12V6M20 6h8M9 24H5M43 24h-4M18 31h12" stroke="#25A9E0" stroke-width="2.4" stroke-linecap="round"/></svg>',
  versus: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l4 8 9-3-2 9 9 4-9 4 2 9-9-3-4 8-4-8-9 3 2-9-9-4 9-4-2-9 9 3z" fill="#E8F7FF" stroke="#25A9E0" stroke-width="2.4" stroke-linejoin="round"/><circle cx="19" cy="22" r="4" fill="#25A9E0"/><circle cx="30" cy="26" r="4" fill="#25A9E0"/></svg>',
  rank: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8h20v8a10 10 0 0 1-20 0z" fill="#FFF6D6" stroke="#E0A31A" stroke-width="2.4"/><path d="M14 11H8a6 6 0 0 0 6 7M34 11h6a6 6 0 0 1-6 7M24 26v8M16 40h16l-2-6H18z" fill="none" stroke="#E0A31A" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  missions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4.5" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="8.5" y="2.5" width="7" height="4" rx="1.2" fill="currentColor"/><path d="M8.5 11h7M8.5 14.5h4M14 16.5l1.3 1.3 2.4-2.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function versusHTML(st) {
  const s = D.mine(), dk = D.deckOf(s), all = matchesOf(st);
  const row = (x, sub, btns) => `<li>${avatarOf(x.opp)}<span class="pk-row-t"><b>${esc(x.opp.name)}${x.opp.guest ? ' <i class="pk-tag">Guest</i>' : ''}</b><small>${sub}</small></span>${btns}</li>`;
  const score = x => (x.G ? `${x.G.p[x.you].pts}–${x.G.p[1 - x.you].pts}` : '');
  const sec = (title, items, f) => (items.length ? `<section class="pk-sec"><h2 class="pk-h">${title}</h2><ul class="pk-list">${items.map(f).join('')}</ul></section>` : '');
  const btn = (label, attrs, kind = 'go') => `<button type="button" class="pk-btn is-${kind}" ${attrs}>${label}</button>`;
  let h = `<button type="button" class="pk-backrow" data-dy-bv="">${ui.icon('chevron-left', {size: 16})} Play</button>`;
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
    : `<p class="pk-note">${daily.LB.ready ? 'Your opponent hasn’t opened Gridiron Rivals yet. Once they do, you can challenge them here.' : 'Loading the other players…'}</p>`;
  h += '</section>';
  h += sec('Finished', all.filter(x => x.state === 'over').slice(0, 10), x => row(x, `${{points: 'Three points', empty: 'No players left', time: 'Turn limit', resign: 'Resigned', claim: 'Left it 72 hours'}[x.why] || ''} · ${score(x)}`,
    `<button type="button" class="pk-res ${x.result === 'w' ? 'is-w' : x.result === 'l' ? 'is-l' : ''}" data-dy-go="${x.mid}">${x.result === 'w' ? 'Won' : x.result === 'l' ? 'Lost' : 'Draw'}</button>`));
  return h;
}
function rankHTML() {
  const rows = D.others(undefined, {withMe: true});
  return `<button type="button" class="pk-backrow" data-dy-bv="">${ui.icon('chevron-left', {size: 16})} Play</button>`
    + (rows.length ? `<ol class="pk-list pk-rank">${rows.map((r, i) => `<li class="${r.me ? 'is-me' : ''}"><span class="pk-rk">${i + 1}</span>`
      + `${r.member ? ui.avatar(r.member, {size: 32, you: r.me}) : ui.nickAvatar(r.name, {size: 32, you: r.me})}`
      + `<span class="pk-row-t"><b>${esc(r.me ? `${r.team} (you)` : r.team)}</b><small>${esc(r.name)}${r.guest ? ' · Guest' : ''} · ${r.rec.w}–${r.rec.l} · ${nf(r.cards)} cards</small></span>`
      + `<span class="pk-tro">${MODE_IC.rank}<b>${nf(r.tr)}</b></span></li>`).join('')}</ol>` : ui.empty({icon: 'trophy', title: 'No rankings yet', body: 'Win battles to climb.'}));
}
function guideSheet() {
  const body = `<ol class="pk-guide">`
    + `<li><b>Build a deck</b>20 cards: players and Trainers, at most 2 of any one, with at least one Basic player.</li>`
    + `<li><b>Set up</b>Start with 5 cards. Put a Basic player out as your active player and up to 3 on your bench.</li>`
    + `<li><b>Each turn</b>Draw a card. The turn’s energy goes on by itself: your active player while his plays need it, else the bench player it helps most. Put Basics on your bench, evolve, play Items (as many as you like), one Coach card and a Stadium, and switch out your active player once.</li>`
    + `<li><b>Tap any card</b>It lifts off the table with what it can do now: your active player’s plays, a bench player’s Send in, a hand card’s play. Put back sets it down.</li>`
    + `<li><b>Attack</b>An attack needs its energy on your active player. Attacking ends your turn. In new matches, the second (signature) attack spends one attached energy; quick plays keep it. Existing matches keep their original rules. Hitting a weakness does +20: Air beats Blitz, Blitz beats Ground, Ground beats Coverage, Coverage beats Air.</li>`
    + `<li><b>Win</b>Knock out a player for a point (a Legend or Prime ex for two). Three points wins.</li>`
    + `<li><b>Solo ladder</b>Thirty games against the computer, each win unlocking the next. The first ones are gentle; from game 16 the computer counters your deck’s main type and plays every trick. A win pays coins (double the first time), and every fifth game’s first win pays packs.</li>`
    + `<li><b>Versus</b>Battles go in turns: play yours when you like, and your opponent gets YOUR MOVE on their Rivals case.</li></ol>`;
  ui.openSheet({title: 'Guide', body, cls: 'pk-sheet', detents: ['large']});
}
// Solo: your battle in play, then the ladder by tier: each game won, the next one to play, or locked, with what it pays.
function soloHTML() {
  const s = D.mine(), dk = D.deckOf(s), cur = SOLO.current(), at = SOLO.ladderAt(s);
  let h = `<button type="button" class="pk-backrow" data-dy-bv="">${ui.icon('chevron-left', {size: 16})} Play</button>`;
  if (!dk.ok) h += `<button type="button" class="pk-alert is-gold" data-dy-tab="decks">${ui.icon('info', {size: 18})}<span>Your deck isn’t ready: ${esc(dk.why)}</span>${ui.icon('chevron-right', {size: 16})}</button>`;
  if (cur) h += `<button type="button" class="pk-alert" data-dy-go="${cur.mid}">${MODE_IC.solo}<span>Your battle against ${esc(cur.opp.name)}: ${cur.state === 'theirs' ? 'its move' : 'your move'} · ${cur.G.p[0].pts}–${cur.G.p[1].pts}</span>${ui.icon('chevron-right', {size: 16})}</button>`;
  const packs = rw => Object.entries(rw).map(([k, n]) => `${n > 1 ? n + ' ' : ''}${D.PACKS[k].name}${n > 1 ? 's' : ''}`).join(', ');
  h += `<p class="pk-note">${at > SOLO.LADDER ? 'You’ve won all thirty. Replay any game for coins.' : `Game ${at} of ${SOLO.LADDER}. Win a game to unlock the next.`}</p>`;
  SOLO.TIERS.forEach((T, i) => {
    const to = (SOLO.TIERS[i + 1] || {from: SOLO.LADDER + 1}).from - 1;
    h += `<section class="pk-sec"><h2 class="pk-h">${esc(T.name)} <small>Games ${T.from}–${to}</small></h2><p class="pk-note">${esc(T.blurb)}</p><ul class="pk-list pk-solo">`
      + SOLO.STAGES.filter(g => g.n >= T.from && g.n <= to).map(g => {
        const wins = s.so[g.id] || 0, open = g.n <= at, P = D.ladderPay(g.n);
        const pay = wins ? `${nf(P.coins)} coins a win` : `First win: ${nf(P.coins * 2)} coins${P.first ? ` + ${esc(packs(P.first))}` : ''}`;
        return `<li class="${g.n === at ? 'is-next' : open ? '' : 'is-locked'}"><span class="pk-solo-n">${wins ? ui.icon('check', {size: 14}) : open ? g.n : ui.icon('lock', {size: 13})}</span><span class="pk-row-t"><b>${esc(g.name)}${wins ? ` <i class="pk-tag is-won">${wins}</i>` : ''}</b>`
          + `<small>Game ${g.n}</small><small class="pk-solo-r">${pay}</small></span>`
          + `<button type="button" class="pk-btn ${g.n === at ? 'is-go' : 'is-soft'}" data-dy-solo="${g.id}"${dk.ok && open ? '' : ' disabled'}>${wins ? 'Replay' : open ? 'Play' : 'Locked'}</button></li>`;
      }).join('') + '</ul></section>';
  });
  return h;
}
function startSolo(st, id) {
  const go = () => { const r = SOLO.start(id); if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; } ui.haptic('success'); st.ctx.nav(`/puzzles/dynasty/battle/${r.mid}`); };
  const cur = SOLO.current();
  if (!cur) { go(); return; }
  ui.actionSheet({title: 'Start a new battle?', message: `Your battle against ${cur.opp.name} ends unplayed.`, cls: 'pk-sheet', actions: [{label: 'Start the new one', role: 'primary', value: 'y'}]})
    .then(v => { if (v === 'y') { SOLO.resign(cur.mid); go(); } });
}
function battleHTML2(st) { return st.bv === 'versus' ? versusHTML(st) : st.bv === 'rank' ? rankHTML() : st.bv === 'solo' ? soloHTML() : battleHome(st); }

// ---------------------------------------------------------------------------------------------------- opening a pack
function openHere(st) {
  const s = D.mine(), kind = st.pack, P = D.PACKS[kind];
  if (kind === D.DAILY_PACK && D.dailyReady(s) && !s.pk[kind] && !D.unlimited()) { D.claimDaily(); openPack(st, kind); return; }
  if (s.pk[kind] > 0 || (D.unlimited() && !P.unique)) { openPack(st, kind); return; }
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
  openScene({kind, design: artAt(st, kind), cards: r.cards, dup: r.dup, cardHTML: anyHTML, onClose: () => refresh(st), focusBack: '.pk-actions [data-dy-openhere]'});
}
function teamPicker(done) {
  const teams = Object.values(D.TEAMS).sort((a, b) => a.name.localeCompare(b.name));
  const body = `<div class="pk-teams">${teams.map(t => `<button type="button" class="pk-teamb" data-dy-team="${t.abbr}" style="--tp:${t.pri}"><img src="${esc(logoUrl(t.abbr, 72))}" alt="" loading="lazy" onerror="this.remove()"><span>${esc(t.name)}</span></button>`).join('')}</div>`;
  const sh = ui.openSheet({title: 'Pick a team', body, cls: 'pk-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-dy-team]');
    if (b) { sh.close(); setTimeout(() => done(b.dataset.dyTeam), 280); }
  });
}

// ---------------------------------------------------------------------------------------------------- the start screen
// Pocket's title screen on entering (the owner, Oct 29 2026: "Create a start screen when entering the dynasty", with
// his screenshot of it): cards drifting over a pastel wash, the logo, Tap to Start, the version and your support id at
// the top left (the red X above them still leaves), the menu at the top right, the credits at the foot. It covers the
// shell till you tap it (or press Enter); back from a battle it doesn't come again (onShow), and the Menu brings it back.
// The cards drift in once they've loaded; till then it says so, and a load that failed is tried again by a tap.
const APP_VER = '3.0'; // Gridiron Hub v3.0 (CLAUDE.md), then the Dynasty's save version
/** Your support id, as Pocket shows one: a short code from your profile's key, the same every time, never the key itself. */
export const supportId = (key = profileKey()) => (D.hash('support|' + (key || 'guest')).toString(36).toUpperCase() + '00000000').slice(0, 8);
// Where the cards drift: left and top (% of the screen), their turn, their size (of a card's width) and depth (0 far,
// blurred and pale, to 2 near), each with its own tempo so they don't move as one.
const START_SPOTS = [
  {x: 4, y: 7, r: -9, s: .7, z: 1}, {x: 56, y: 3, r: 8, s: .56, z: 0}, {x: 72, y: 13, r: 6, s: .94, z: 2}, {x: 8, y: 24, r: -6, s: 1, z: 2},
  {x: 42, y: 20, r: 3, s: .5, z: 0}, {x: 70, y: 37, r: -4, s: .62, z: 1}, {x: -5, y: 50, r: -12, s: .6, z: 0}, {x: 60, y: 54, r: 7, s: 1, z: 2},
  {x: 10, y: 60, r: 5, s: .9, z: 2}, {x: 86, y: 58, r: -7, s: .55, z: 0}, {x: 40, y: 66, r: -3, s: .7, z: 1}, {x: 70, y: 74, r: 9, s: .8, z: 1},
  {x: -3, y: 84, r: 6, s: .62, z: 0}, {x: 78, y: 91, r: -8, s: .55, z: 0}
];
/** The cards on the title screen: the best Legends, Prime and Award stars, this season's best and Gameday cards, each
 *  of a different team where it can be, in a fixed order (the Legends nearest). */
export function startCards(n = START_SPOTS.length) {
  const by = (f, k) => D.CARDS.filter(f).sort((a, b) => b.o - a.o || a.name.localeCompare(b.name)).slice(0, k);
  const pool = [...by(c => c.s === 'X', 5), ...by(c => c.s === 'P', 3), ...by(c => c.s === 'A', 2), ...by(c => c.s === 'L', 6), ...by(c => c.s === 'G', 3)];
  const out = [], teams = new Set();
  pool.forEach(c => { if (out.length < n && !teams.has(c.team)) { out.push(c); teams.add(c.team); } });
  pool.forEach(c => { if (out.length < n && !out.includes(c)) out.push(c); });
  return out;
}
function startCardsHTML() {
  const cards = startCards();
  const order = START_SPOTS.map((p, i) => ({p, i})).sort((a, b) => b.p.z - a.p.z || a.i - b.i);
  return order.map(({p, i}, k) => (cards[k] ? `<span class="pk-start-card z-${p.z}" style="--x:${p.x}%;--y:${p.y}%;--r:${p.r}deg;--s:${p.s};--t:${(5.2 + (i % 5) * .9).toFixed(1)}s;--d:${(-((i * 1.37) % 6)).toFixed(2)}s">`
    + `${cardHTML(cards[k], {size: 's', tag: false, noCount: true})}</span>` : '')).join('');
}
const startSay = () => (D.status === 'ready' ? 'Tap to Start' : D.status === 'error' ? 'The cards didn’t load. Tap to try again' : 'Loading the cards…');
export function startHTML() {
  return `<div class="pk-start${D.status === 'ready' ? ' is-ready' : ''}" data-dy-start role="button" tabindex="0" aria-label="Tap to start Gridiron Rivals">`
    + `<div class="pk-start-cards" data-dy-start-cards aria-hidden="true">${D.status === 'ready' ? startCardsHTML() : ''}</div>`
    + `<div class="pk-start-top">${ui.exitButton('data-dy-exit', 'Exit Gridiron Rivals')}<span class="pk-start-ver"><span>Ver. ${APP_VER}.${D.VERSION}</span><span>Support ID: ${supportId()}</span></span>`
    + `<button type="button" class="pk-start-menu" data-dy-menu aria-label="Menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>`
    + `<div class="pk-start-logo" role="img" aria-label="Gridiron Rivals: Trading Card Game"><span class="pk-logo-top">Gridiron</span><span class="pk-logo-plate">Trading Card Game</span><span class="pk-logo-sub">Rivals</span></div>`
    + `<p class="pk-start-tap" data-dy-start-say aria-live="polite">${startSay()}</p>`
    + `<p class="pk-start-credits">© Gridiron Gangbang · Gridiron Hub<br>Player photos: ESPN · NFL · Football Card Gallery · CardSight</p></div>`;
}
/** Keeps the title screen in step: its cards once they've loaded, its line, the shell inert beneath it. */
function drawStart(st) {
  const sc = st.el.querySelector('[data-dy-start]');
  st.el.querySelector('.pk').classList.toggle('is-start', !!sc);
  ['.pk-hdr', '[data-dy-pane]', '.pk-nav'].forEach(q => { const el = st.el.querySelector(q); if (el) { if (sc) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } });
  if (!sc) return;
  const say = sc.querySelector('[data-dy-start-say]'), cards = sc.querySelector('[data-dy-start-cards]');
  if (say && say.textContent !== startSay()) say.textContent = startSay();
  sc.classList.toggle('is-ready', D.status === 'ready');
  if (D.status === 'ready' && cards && !cards.firstChild) cards.innerHTML = startCardsHTML();
}
/** Tap to Start: the title screen lifts and the Packs are there. Before the cards are in, a tap only nudges (or tries
 *  the load again after it failed). */
function startGame(st) {
  const sc = st.el.querySelector('[data-dy-start]');
  if (!sc || st.starting) return;
  if (D.status === 'error') { D.load().then(() => refresh(st), () => refresh(st)); refresh(st); return; }
  if (D.status !== 'ready') { sc.classList.remove('is-wait'); void sc.offsetWidth; sc.classList.add('is-wait'); ui.haptic('light'); return; }
  st.starting = true;
  ui.haptic('medium');
  sc.classList.add('is-out');
  sc.setAttribute('aria-hidden', 'true');
  const done = () => {
    sc.remove(); st.starting = false;
    if (st.dead) return;
    drawStart(st);
    const h = st.el.querySelector('[data-pk-title]');
    if (h) { try { h.focus({preventScroll: true}); } catch (_) {} }
  };
  if (RM()) done(); else setTimeout(done, 460);
}
/** Back to the title screen (the Menu). */
function showStart(st) {
  if (st.el.querySelector('[data-dy-start]')) return;
  st.el.querySelector('.pk').insertAdjacentHTML('beforeend', startHTML());
  drawStart(st);
  st.el.querySelector('[data-dy-pane]').scrollTop = 0;
  const sc = st.el.querySelector('[data-dy-start]');
  if (sc) { try { sc.focus({preventScroll: true}); } catch (_) {} }
}

// ---------------------------------------------------------------------------------------------------- the Menu (≡)
// Pocket's menu: the Guide, your coins, the rankings, this pack's Offering Rates, the title screen and the exit.
function menuSheet(st) {
  const s = D.status === 'ready' ? D.mine() : null, P = D.PACKS[st.pack] || D.PACKS[D.DAILY_PACK];
  const items = [
    {id: 'guide', ic: 'info', label: 'Guide', sub: 'How to play'},
    {id: 'coins', ic: 'sparkle', label: 'Coins', sub: s ? `${nf(D.balance(s))} · how you earn them` : 'How you earn them'},
    {id: 'rank', ic: 'trophy', label: 'Rankings', sub: s ? `${nf(s.tr)} trophies · ${s.rec.w}–${s.rec.l}` : 'The Rivals board'},
    {id: 'odds', ic: 'chart', label: 'Offering Rates', sub: P.name},
    {id: 'title', ic: 'play-fill', label: 'Title screen', sub: 'Back to the start'},
    {id: 'exit', ic: 'close', label: 'Exit Gridiron Rivals', sub: 'Back to Daily Games', cls: 'is-exit'}
  ];
  const body = `<ul class="pk-list pk-menu">${items.map(x => `<li><button type="button" class="pk-menu-b${x.cls ? ' ' + x.cls : ''}" data-dy-m="${x.id}"><i class="pk-menu-i">${ui.icon(x.ic, {size: 20})}</i>`
    + `<span class="pk-row-t"><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></span>${ui.icon('chevron-right', {size: 16})}</button></li>`).join('')}</ul>`
    + `<p class="pk-note pk-menu-foot">Gridiron Rivals · Ver. ${APP_VER}.${D.VERSION} · Support ID ${supportId()}</p>`;
  const sh = ui.openSheet({title: 'Menu', body, cls: 'pk-sheet', detents: ['fit']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-dy-m]');
    if (!b) return;
    const id = b.dataset.dyM;
    ui.haptic('selection'); sh.close();
    setTimeout(() => {
      if (st.dead) return;
      if (id === 'guide') guideSheet();
      else if (id === 'coins') { if (s) earnSheet(); }
      else if (id === 'rank') { if (s) { st.bv = 'rank'; go(st, 'battle', {keep: true}); } }
      else if (id === 'odds') oddsSheet(st.pack);
      else if (id === 'title') showStart(st);
      else if (id === 'exit') ui.confirmExit({game: 'Gridiron Rivals', cls: 'pk-sheet'}).then(home => { if (home && !st.dead) st.ctx.back(); });
    }, 280);
  });
}

// ---------------------------------------------------------------------------------------------------- the screen
const PANES = {packs: packsHTML, cards: cardsHTML, decks: decksHTML, battle: battleHTML2};
// Replaying multiplayer logs is expensive. Share one short-lived snapshot across the badge and screens;
// match/board/profile events and returning from a battle invalidate it before it can be used again.
function matchesOf(st) {
  const key = profileKey(), now = Date.now();
  if (!st.matches || st.matchKey !== key || now - st.matchAt > 15000) {
    st.matches = MT.list(); st.matchKey = key; st.matchAt = now;
  }
  return st.matches;
}
const waitingOf = st => matchesOf(st).filter(x => ['invite', 'setup', 'yours'].includes(x.state)).length;
const paneKey = st => JSON.stringify([st.tab, st.tab === 'cards' ? st.f : st.tab === 'battle' ? st.bv : st.tab === 'packs' ? [st.pack, st.art] : null]);
// Pack countdowns and battle idle times age even without a save event. Reusing nodes must not reset their age.
const paneFresh = (tab, at) => !(tab === 'packs' || tab === 'battle') || Date.now() - at < 15000;
function invalidatePanes(st, matches = false) {
  st.revision++; st.panes.clear();
  if (matches) st.matches = null;
}
// Multiple data notifications from one action paint once. A covered hub does no DOM work until shown again.
function scheduleRefresh(st) {
  if (st.dead || st.hidden || st.refreshFrame) return;
  st.refreshFrame = requestAnimationFrame(() => { st.refreshFrame = 0; refresh(st); });
}
function updateChrome(st) {
  const el = st.el, hud = hudHTML(D.mine());
  if (hud !== st.hud) { el.querySelector('[data-dy-hud]').innerHTML = hud; st.hud = hud; }
  el.querySelector('[data-pk-title]').textContent = (PANE_TABS.find(t => t.id === st.tab) || PANE_TABS[0]).title;
  el.querySelectorAll('.pk-tab[data-dy-tab]').forEach(b => { const on = b.dataset.dyTab === st.tab; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  const dot = el.querySelector('.pk-tab[data-dy-tab="battle"] .pk-dot');
  if (dot) dot.hidden = !waitingOf(st);
}
// While you're playing, the app's menu at the foot of the screen goes (the owner, Oct 28 2026: "Remove the menu at the
// bottom of the screen when the user is actively playing in the game"), as Keepfall's does; the header's back button
// leaves. (A battle covers the menu already.)
function fullScreen(st, on) {
  document.documentElement.classList.toggle('is-dynasty-playing', !!on && !st.dead && D.mayPlay());
}
function refresh(st) {
  if (st.dead || st.hidden) return;
  if (st.refreshFrame) { cancelAnimationFrame(st.refreshFrame); st.refreshFrame = 0; }
  const el = st.el;
  // (Evan's and Ryan Stewart's alone, Oct 28 2026: a profile switched while it's open leaves it)
  if (!D.mayPlay()) {
    fullScreen(st, false); el.querySelector('[data-dy-pane]').innerHTML = '';
    const sc = el.querySelector('[data-dy-start]'); if (sc) sc.remove(); drawStart(st);
    if (!st.left) { st.left = true; st.ctx.back(); }
    return;
  }
  drawStart(st);
  if (D.status !== 'ready') {
    el.querySelector('[data-dy-pane]').innerHTML = D.status === 'error' ? ui.empty({icon: 'info', title: 'The cards didn’t load', body: 'Check your connection.', action: {label: 'Try again', kind: 'primary', attrs: {'data-dy-retry': ''}}}) : ui.skeleton('rows', 4, {label: 'Loading the cards'});
    return;
  }
  updateChrome(st);
  const pane = el.querySelector('[data-dy-pane]');
  const input = pane.querySelector('input[name="dy-q"]');
  const selection = input && input === document.activeElement ? [input.selectionStart, input.selectionEnd] : null;
  // (a finger on the big pack mid-swipe: the redraw waits till it's let go, swEnd)
  if (st.tab === 'packs' && st.sw && st.sw.on) { st.dirty = true; return; }
  // (the pack, an arrow or a dot focused: the same one after the redraw)
  const had = document.activeElement, fk = had && pane.contains(had) ? (had.matches('[data-dy-art]') ? `[data-dy-art="${had.dataset.dyArt}"]` : had.matches('[data-dy-artat]') ? `[data-dy-artat="${had.dataset.dyArtat}"]` : had.matches('.pk-bigpack') ? '.pk-bigpack' : had.matches('[data-dy-to]') ? '.pk-car-bk' : '') : '';
  pane.innerHTML = PANES[st.tab](st);
  ui.hydrate(pane);
  if (fk) { const again = pane.querySelector(fk); if (again) try { again.focus({preventScroll: true}); } catch (_) {} }
  if (st.tab === 'cards' && st.f.view !== 'cols') drawGrid(st);
  if (selection && st.tab === 'cards') {
    const next = pane.querySelector('input[name="dy-q"]');
    if (next) { next.focus({preventScroll: true}); next.setSelectionRange(...selection); }
  }
  st.renderedTab = st.tab; st.renderedKey = paneKey(st); st.renderedRevision = st.revision; st.renderedAt = Date.now();
}
function go(st, tab, {keep = false} = {}) {
  if (!PANES[tab] || st.dead) return;
  clearTimeout(st.qT);
  if (st.refreshFrame) { cancelAnimationFrame(st.refreshFrame); st.refreshFrame = 0; }
  const pane = st.el.querySelector('[data-dy-pane]'), previous = st.tab;
  // Detached nodes retain decoded images, hydrated controls and pagination without painting hidden tabs.
  if (previous !== tab && st.renderedTab === previous && st.renderedRevision === st.revision) {
    const fragment = document.createDocumentFragment(), top = pane.scrollTop;
    while (pane.firstChild) fragment.append(pane.firstChild);
    st.panes.set(previous, {fragment, top, shown: st.shown, gridKey: st.gridKey, key: st.renderedKey, at: st.renderedAt});
  }
  st.tab = tab;
  if (tab === 'battle' && !keep) st.bv = '';
  if (previous === tab && st.renderedKey === paneKey(st) && st.renderedRevision === st.revision && paneFresh(tab, st.renderedAt)) return;
  const cached = st.panes.get(tab);
  st.panes.delete(tab);
  if (cached && cached.key === paneKey(st) && paneFresh(tab, cached.at)) {
    const revision = st.revision;
    updateChrome(st);
    if (st.revision !== revision) { refresh(st); pane.scrollTop = 0; return; }
    pane.replaceChildren(cached.fragment); st.shown = cached.shown; st.gridKey = cached.gridKey;
    st.renderedTab = tab; st.renderedKey = cached.key; st.renderedRevision = st.revision; st.renderedAt = cached.at;
    pane.scrollTop = cached.top;
    return;
  }
  refresh(st);
  pane.scrollTop = 0;
}

export default {
  id: 'dynasty',
  chrome: 'none',
  title: 'Rivals',

  render() { return shellHTML(); },

  mount(el, ctx) {
    const st = {el, ctx, tab: 'battle', pack: D.DAILY_PACK, art: artLoad(), bv: '', f: {view: 'mine', ser: '', pos: '', rar: '', q: ''}, shown: PAGE, dead: false, starting: false, stops: [], panes: new Map(), revision: 0, refreshFrame: 0, hidden: false};
    ST.set(ctx, st);
    fullScreen(st, ctx.visible);
    ctx.setBackTitle('Rivals');
    el.addEventListener('input', e => {
      if (e.target.name === 'dy-q') { st.f.q = e.target.value; clearTimeout(st.qT); st.qT = setTimeout(() => drawGrid(st), 160); }
    });
    // (the title screen: Enter or Space on it starts, as a tap does)
    el.addEventListener('keydown', e => {
      const sc = e.target && e.target.closest ? e.target.closest('[data-dy-start]') : null;
      if (sc && e.target === sc && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startGame(st); }
    });
    el.addEventListener('click', e => {
      const t = e.target;
      const q = sel => t.closest(sel);
      let b;
      if (q('[data-dy-exit]')) { ui.confirmExit({game: 'Gridiron Rivals', cls: 'pk-sheet'}).then(home => { if (home && !st.dead) ctx.back(); }); return; }
      if (q('[data-dy-menu]')) { menuSheet(st); return; }
      if (q('[data-dy-retry]')) { D.load().then(() => refresh(st), () => refresh(st)); refresh(st); return; }
      if ((b = q('[data-dy-tab]'))) { go(st, b.dataset.dyTab); return; }
      if ((b = q('[data-dy-goto]'))) { st.f.view = 'cols'; go(st, 'cards'); return; }
      if ((b = q('[data-dy-cv]'))) { st.f.view = b.dataset.dyCv; refresh(st); return; }
      if (q('[data-dy-all]')) { st.f.view = st.f.view === 'all' ? 'mine' : 'all'; ui.haptic('selection'); refresh(st); return; }
      if (q('[data-dy-filter]')) { filterSheet(st); return; }
      // (the packs: a swipe that just ended never opens the front one nor brings one behind forward)
      if (q('[data-dy-car]') && performance.now() - (st.swiped || -1e4) < 450) return;
      if ((b = q('[data-dy-to]'))) { packTo(st, packKinds(D.mine()).indexOf(b.dataset.dyTo), 1); return; }
      if ((b = q('[data-dy-art]'))) { const d = +b.dataset.dyArt; artTo(st, artAt(st, st.pack) + d, d); return; }
      if ((b = q('[data-dy-artat]'))) { const i = +b.dataset.dyArtat; artTo(st, i, i < artAt(st, st.pack) ? -1 : 1); return; }
      if (q('[data-dy-openhere]')) { openHere(st); return; }
      if (q('[data-dy-packs]')) { packsSheet(st); return; }
      if (q('[data-dy-points]')) { pointsSheet(st); return; }
      if (q('[data-dy-earn]')) { earnSheet(); return; }
      if ((b = q('[data-dy-odds]'))) { oddsSheet(b.dataset.dyOdds); return; }
      if ((b = q('[data-dy-bv]'))) { st.bv = b.dataset.dyBv; refresh(st); el.querySelector('[data-dy-pane]').scrollTop = 0; return; }
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
      if ((b = q('[data-dy-strategy]'))) {
        const plan = D.STRATEGIES.find(x => x.id === b.dataset.dyStrategy), candidate = D.strategyDeck(b.dataset.dyStrategy, D.mine().o);
        if (!candidate.ok) { ui.toast(candidate.why, {icon: 'info'}); return; }
        const r = D.setDeck(candidate.ids);
        if (r && !r.ok) { ui.toast(r.why, {icon: 'info'}); return; }
        ui.haptic('success'); ui.toast(`${plan.name} deck ready`, {icon: 'check-circle'}); refresh(st); return;
      }
      if (q('[data-dy-autodeck]')) { D.setDeck(D.autoDeck(D.mine().o)); ui.haptic('success'); ui.toast('Your best deck is in', {icon: 'check-circle'}); refresh(st); return; }
      if (q('[data-dy-rename]')) { renameSheet(st); return; }
      const run = (r, then) => { if (!r.ok) { ui.toast(r.why, {icon: 'info'}); return; } ui.haptic('success'); if (then) then(r); refresh(st); };
      if ((b = q('[data-dy-solo]'))) { startSolo(st, b.dataset.dySolo); return; }
      if ((b = q('[data-dy-challenge]'))) { run(MT.challenge(b.dataset.dyChallenge), () => ui.toast('Challenge sent. It’s on their Rivals now.', {icon: 'check-circle'})); return; }
      if ((b = q('[data-dy-accept]'))) { run(MT.accept(b.dataset.dyAccept), r => ctx.nav(`/puzzles/dynasty/battle/${r.mid}`)); return; }
      if ((b = q('[data-dy-decline]'))) { run(MT.decline(b.dataset.dyDecline)); return; }
      if ((b = q('[data-dy-cancel]'))) { run(MT.cancel(b.dataset.dyCancel)); return; }
      if ((b = q('[data-dy-claimwin]'))) { run(MT.claim(b.dataset.dyClaimwin), () => ui.toast('Win claimed', {icon: 'trophy'})); return; }
      if ((b = q('[data-dy-go]'))) { ctx.nav(`/puzzles/dynasty/battle/${b.dataset.dyGo}`); return; }
      // (a tap anywhere else on the title screen starts)
      if (q('[data-dy-start]')) startGame(st);
    });
    // (the packs: the front pack follows a sideways swipe and the next pack (or the one before) comes to the front past
    // 50px or a flick, else it springs back; an up-and-down drag scrolls the page as ever; ← and → on the pack step
    // through the packs too, and on the dots under it through its designs)
    el.addEventListener('pointerdown', e => {
      const car = e.target.closest('.pk-car.is-many');
      // (one finger at a time: a second one landing mid-swipe is ignored, never takes the swipe over)
      if (!car || !e.isPrimary || (st.sw && st.sw.on) || e.target.closest('[data-dy-art]') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      st.sw = {id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false, lx: e.clientX, lt: performance.now(), v: 0, car};
    });
    el.addEventListener('pointermove', e => {
      const w = st.sw;
      if (!w || e.pointerId !== w.id) return;
      // (the pane redrawn under the finger: the swipe goes on with the new pack)
      if (!w.car.isConnected) { const c = st.el.querySelector('.pk-car.is-many'); if (!c) { st.sw = null; return; } w.car = c; if (w.on) c.classList.add('is-drag'); }
      const dx = e.clientX - w.x, dy = e.clientY - w.y, now = performance.now();
      if (!w.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { st.sw = null; return; }
        if (Math.abs(dx) < 8) return;
        w.on = true; w.car.classList.add('is-drag');
        try { w.car.setPointerCapture(e.pointerId); } catch (_) {}
      }
      w.v = (e.clientX - w.lx) / Math.max(1, now - w.lt); w.lx = e.clientX; w.lt = now; w.dx = dx;
      const mv = w.car.querySelector('.pk-car-move'), rp = st.el.querySelector('.pk-reflect > .pk-pack');
      if (mv) mv.style.transform = `translateX(${(dx * .85).toFixed(1)}px) rotate(${(dx / 50).toFixed(2)}deg)`;
      // (its reflection goes with it, mirrored)
      if (rp) rp.style.transform = `translateX(${(dx * .85).toFixed(1)}px) rotate(${(-dx / 50).toFixed(2)}deg)`;
    });
    const swEnd = e => {
      const w = st.sw;
      if (!w || e.pointerId !== w.id) return;
      st.sw = null;
      if (!w.on) return;
      w.car.classList.remove('is-drag');
      st.swiped = performance.now();
      const d = w.dx < 0 ? 1 : -1, go = e.type === 'pointerup' && (Math.abs(w.dx) > 50 || (Math.abs(w.dx) > 16 && Math.abs(w.v) > .45));
      packTo(st, packKinds(D.mine()).indexOf(st.pack) + (go ? d : 0), d);
      // (a redraw held off while the finger was down (refresh: st.dirty) comes once the pack has settled)
      if (st.dirty) { st.dirty = false; setTimeout(() => { if (st.tab === 'packs') refresh(st); }, 500); }
    };
    el.addEventListener('pointerup', swEnd);
    el.addEventListener('pointercancel', swEnd);
    el.addEventListener('keydown', e => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !e.target.closest('.pk-car.is-many, .pk-car-dots')) return;
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1, dot = e.target.closest('[data-dy-artat]');
      if (!e.target.closest('.pk-car-dots')) { packTo(st, packKinds(D.mine()).indexOf(st.pack) + d, d); return; }
      artTo(st, artAt(st, st.pack) + d, d);
      // (on a dot, the focus goes along to the one now chosen)
      if (dot) { const to = st.el.querySelector(`[data-dy-artat="${artAt(st, st.pack)}"]`); if (to) to.focus(); }
    });
    st.stops.push(D.subscribe(why => { invalidatePanes(st, why === 'profile' || why === 'data' || why === 'sync'); if (why !== 'change' && why !== 'open') scheduleRefresh(st); }));
    st.stops.push(MT.subscribe(() => { invalidatePanes(st, true); scheduleRefresh(st); }));
    st.stops.push(SOLO.subscribe(() => { invalidatePanes(st); if (st.tab === 'battle') scheduleRefresh(st); }));
    st.stops.push(ctx.on('daily', type => { if (type === 'lb') { invalidatePanes(st, true); if (D.status === 'ready' && D.mayPlay()) { D.sync(); D.earned(D.mine(), true); } if (st.tab === 'battle' || st.tab === 'packs') scheduleRefresh(st); } }));
    st.stops.push(data.subscribe(type => { if (type === 'me') { invalidatePanes(st, true); refresh(st); } }));
    st.stops.push(ctx.timer(() => { if (!st.hidden && D.status === 'ready' && D.mayPlay()) updateChrome(st); }, 15000));
    try { ui.lsSet('gg-dynasty-seen', '1'); } catch (_) {}
    D.load().then(() => scheduleRefresh(st), () => scheduleRefresh(st));
    D.loadGames().then(() => { if (D.status === 'ready' && D.mayPlay()) { D.earned(D.mine(), true); scheduleRefresh(st); } });
    refresh(st);
  },

  // (back from a battle: the matches as they stand now; the title screen doesn't come again)
  onShow(ctx) { const st = ST.get(ctx); if (st) { st.hidden = false; invalidatePanes(st, true); fullScreen(st, true); refresh(st); } },

  onHide(ctx) { const st = ST.get(ctx); if (st) { st.hidden = true; clearTimeout(st.qT); cancelAnimationFrame(st.refreshFrame); st.refreshFrame = 0; fullScreen(st, false); } },

  unmount(el, ctx) {
    const st = ST.get(ctx);
    if (!st) return;
    fullScreen(st, false);
    st.dead = true;
    clearTimeout(st.qT); cancelAnimationFrame(st.refreshFrame); st.panes.clear();
    st.stops.forEach(f => { try { f(); } catch (_) {} });
    D.flush(); MT.flush();
    ST.delete(ctx);
  }
};
