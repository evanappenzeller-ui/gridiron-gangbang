// League's Draft segment (#/league/draft[/trades|/repeats|/<year>]): the Draft view (moves.js: drafts, trades, repeats
// and player search) as a segment module for league.js: {render, mount, unmount, params, me, show, onAction}.
// The screen also carries .v-moves while it shows, since the Draft stylesheet is scoped to it. Owner: LEAGUE.
import moves from './moves.js';

const asReason = (ctx, reason, fn) => { const r = ctx.reason; ctx.reason = reason; try { fn(); } finally { ctx.reason = r; } };

export function render(ctx) { return `<div class="lg-draft">${moves.render(ctx)}</div>`; }
export function mount(el, ctx) {
  if (ctx.screen) ctx.screen.classList.add('v-moves');
  moves.mount(el, ctx);
}
export function unmount(el, ctx) {
  moves.unmount(el, ctx);
  if (ctx.screen) ctx.screen.classList.remove('v-moves');
}
// A new sub-route (Trades, a year, a manager filter): Draft patches its list in place.
export function params(ctx) { asReason(ctx, 'params', () => moves.update(ctx)); }
export function me(ctx) { asReason(ctx, 'me', () => moves.update(ctx)); }
export function show(ctx) { moves.onShow(ctx); }
export function onAction(id, ctx) { return moves.onAction(id, ctx); }
