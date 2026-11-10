import * as D from '../core/dynasty.js';
import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import {profileKey} from '../core/realm-active.js';

const {esc, nf} = data;
const PAGE = 24;
const state = st => st.market ||= {mode: 'buy', rarity: '', q: '', sort: 'rating', shown: PAGE};
const money = n => `${nf(n)} coins`;
const catalog = () => [...D.CARDS, ...D.TRAINER_IDS.map(D.trainer)].filter(c => D.marketQuote(c));

export function marketHTML(st, face) {
  const f = state(st), s = D.mine(), query = f.q.trim().toLowerCase();
  const cards = catalog().filter(c => (f.mode !== 'sell' || s.o[c.id] > 0)
    && (!f.rarity || c.r === f.rarity)
    && (!query || `${c.name} ${c.team || ''} ${c.pos || ''}`.toLowerCase().includes(query)));
  const price = c => D.marketQuote(c)[f.mode === 'sell' ? 'sell' : 'buy'];
  cards.sort((a, b) => (f.sort === 'low' ? price(a) - price(b) : f.sort === 'high' ? price(b) - price(a) : (b.o || 0) - (a.o || 0)) || a.name.localeCompare(b.name));
  return `<section class="rm-market" aria-label="Card marketplace">
    <div class="rm-intro"><small>THE TRANSFER MARKET</small><h2>Find your next franchise player.</h2><p>Save for a star. Sell cards to build your coin balance.</p><span class="rm-wallet">YOUR COINS <b>${D.unlimitedCoins() ? 'Unlimited' : nf(D.balance(s))}</b></span></div>
    <div class="rm-tiers"><span>EPIC <b>12K–16K</b></span><span>LEGENDARY <b>60K–90K</b></span><span>MYTHIC <b>450K–750K</b></span></div>
    <p class="rm-explainer">Fixed game-market prices, no waiting for another player. Buy prices and sell offers differ. Quick sell pays 70% of the market’s sell offer.</p>
    <div class="rm-modes" aria-label="Marketplace view">${['buy', 'sell'].map(mode => `<button type="button" data-market-mode="${mode}" aria-pressed="${f.mode === mode}">${mode === 'buy' ? 'Buy cards' : 'Sell my cards'}</button>`).join('')}</div>
    <div class="rm-filters"><label class="rm-search">Find a card<input type="search" data-market-search value="${esc(f.q)}" placeholder="Player, team or position" autocomplete="off"></label>
    <label>Rarity<select data-market-rarity><option value="">All rarities</option>${D.RARITY.map(r => `<option value="${r}"${r === f.rarity ? ' selected' : ''}>${D.RARITY_NAME[r]}</option>`).join('')}</select></label>
    <label>Sort by<select data-market-sort>${[['rating', 'Overall rating'], ['low', 'Price: low to high'], ['high', 'Price: high to low']].map(([id, name]) => `<option value="${id}"${id === f.sort ? ' selected' : ''}>${name}</option>`).join('')}</select></label></div>
    <div class="rm-results"><b>${nf(cards.length)} ${f.mode === 'sell' ? 'owned cards' : 'cards'}</b><span>${f.mode === 'sell' ? 'Saved-deck copies are protected' : 'One card per purchase'}</span></div>
    <div class="rm-grid">${cards.slice(0, f.shown).map(c => {
      const quote = D.marketQuote(c), own = s.o[c.id] || 0, available = D.sellableCount(c.id, s);
      return `<article class="rm-card" data-rarity="${c.r}"><button type="button" class="rm-face" data-market-card="${esc(c.id)}" aria-label="${esc(c.name)}: ${f.mode === 'sell' ? 'market offer' : 'buy for'} ${money(price(c))}">${face(c.id, {size: 's', tag: false, noCount: true})}</button>
        <div class="rm-card-copy"><b>${esc(c.name)}</b><small>${D.RARITY_NAME[c.r]}${c.o ? ` · ${c.o} OVR` : ' · Support'} · Owned ${own}</small>
        <dl><div><dt>${f.mode === 'sell' ? 'Market offer' : 'Buy now'}</dt><dd>${nf(price(c))}</dd></div><div><dt>${f.mode === 'sell' ? 'Quick sell' : 'Market sell'}</dt><dd>${nf(f.mode === 'sell' ? quote.quick : quote.sell)}</dd></div></dl>
        <button type="button" class="rm-trade" data-market-card="${esc(c.id)}">${f.mode === 'sell' ? (available ? 'Review sale' : 'In saved decks') : 'View offer'}</button></div></article>`;
    }).join('')}</div>
    ${!cards.length ? `<div class="rm-empty"><h3>${f.mode === 'sell' && !f.q && !f.rarity ? 'Your next sale starts with a pack.' : 'No matching cards'}</h3><p>${f.mode === 'sell' && !f.q && !f.rarity ? 'Cards you collect will appear here with a market offer.' : 'Try another name or rarity.'}</p></div>` : ''}
    ${cards.length > f.shown ? '<button type="button" class="rm-more" data-market-more>Show more cards</button>' : ''}
  </section>`;
}

export function marketSheet(st, id, face, refresh) {
  const c = D.anyCard(id), quote = D.marketQuote(c);
  if (!quote) return;
  const key = profileKey(), s = D.mine(), mode = state(st).mode, own = s.o[id] || 0;
  D.earned(s, true);
  const available = D.sellableCount(id, s), canBuy = own < 99 && D.balance(s) >= quote.buy;
  const body = `<div class="rm-detail"><div class="rm-detail-face">${face(id, {size: 'l', tag: false, noCount: true})}</div>
    <p>${D.RARITY_NAME[c.r]} · ${own} owned · ${available} available to sell</p>
    <dl class="rm-quotes"><div><dt>Buy now</dt><dd>${money(quote.buy)}</dd></div><div><dt>Market sell offer</dt><dd>${money(quote.sell)}</dd></div><div><dt>Quick sell</dt><dd>${money(quote.quick)}</dd></div></dl>
    <p class="pk-note">${mode === 'buy' ? `One copy goes straight to your collection. ${own >= 99 ? 'You already hold the maximum 99 copies.' : !canBuy ? `Save ${money(quote.buy - D.balance(s))} more to buy this card.` : ''}` : `${available ? 'Selling removes one copy from your collection.' : 'Copies used by any saved deck are protected. Remove the card from those decks to sell it.'} Quick selling pays less than the market offer.`}</p>
    <div class="pk-acts">${mode === 'buy' ? ui.button({label: `Confirm purchase · ${nf(quote.buy)}`, kind: 'primary', block: true, disabled: !canBuy, attrs: {'data-market-confirm': 'buy'}})
      : ui.button({label: `Sell to market · ${nf(quote.sell)}`, kind: 'primary', block: true, disabled: !available, attrs: {'data-market-confirm': 'sell'}})
      + ui.button({label: `Quick sell · ${nf(quote.quick)}`, kind: 'secondary', block: true, disabled: !available, attrs: {'data-market-confirm': 'quick'}})}
    ${ui.button({label: 'Cancel', kind: 'secondary', block: true, attrs: {'data-market-cancel': ''}})}</div></div>`;
  let stop = () => {}, done = false;
  const sh = ui.openSheet({title: c.name, body, cls: 'pk-sheet', detents: ['large'], onClose: () => { done = true; stop(); }});
  stop = D.subscribe(why => { if (why === 'profile') sh.close(); });
  sh.body.addEventListener('click', e => {
    if (e.target.closest('[data-market-cancel]')) { sh.close(); return; }
    const b = e.target.closest('[data-market-confirm]');
    if (!b || b.disabled || done) return;
    if (st.dead || st.hidden || key !== profileKey() || !D.mayPlay()) { sh.close(); return; }
    done = true;
    const action = b.dataset.marketConfirm;
    const r = action === 'buy' ? D.buyCard(id) : action === 'sell' ? D.sellCard(id) : D.sell(id, 1);
    sh.close();
    if (!r.ok) { ui.toast(r.why || 'That copy is no longer available.', {icon: 'info'}); refresh(); return; }
    ui.haptic('success');
    ui.toast(action === 'buy' ? `${c.name} added to your collection` : `Sold for ${nf(r.coins)} coins`, {icon: 'check-circle'});
    refresh();
  });
}

export function marketEvent(e, st, face, refresh) {
  const t = e.target, f = state(st);
  if (e.type === 'input' && t.matches('[data-market-search]')) { f.q = t.value; f.shown = PAGE; refresh(); return true; }
  if (e.type === 'change' && t.matches('[data-market-rarity], [data-market-sort]')) { f[t.matches('[data-market-rarity]') ? 'rarity' : 'sort'] = t.value; f.shown = PAGE; refresh(); return true; }
  if (e.type !== 'click') return false;
  const mode = t.closest('[data-market-mode]'), card = t.closest('[data-market-card]');
  if (mode) { f.mode = mode.dataset.marketMode; f.shown = PAGE; refresh(); return true; }
  if (card) { marketSheet(st, card.dataset.marketCard, face, refresh); return true; }
  if (t.closest('[data-market-more]')) { f.shown += PAGE; refresh(); return true; }
  return false;
}
