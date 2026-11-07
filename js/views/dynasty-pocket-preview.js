// A tapped athlete floats above the table as its printed card (November 7, 2026, Evan's video).
// Your Active's attacks glow as banners over the printed attacks; Retreat sits on the footer.
// Tapping outside the card sets it back down. Display only: the battle view builds the model
// from the engine's legal moves and every choice goes back through its send().
import {esc} from '../core/data.js';
import {pipHTML} from './dynasty.js';
import {energySVG, ENERGY_COLOR as COLOR} from './dynasty-energy.js';

const GLYPH = {asleep:'zZ', poisoned:'☠', burned:'♨', paralyzed:'⚡', confused:'?'};
export const conditionBadges = (conditions = {}) => Object.keys(GLYPH).filter(k => conditions[k])
  .map(k => `<span class="rp-status-badge is-${k}" title="${k[0].toUpperCase() + k.slice(1)}"><span aria-hidden="true">${GLYPH[k]}</span><span class="rp-sr-only">${k[0].toUpperCase() + k.slice(1)}</span></span>`).join('');
// offsetTop ignores the tilt transform, so layout positions stay exact while the card leans.
function offsetIn(el, root) { let y = 0; for (let n = el; n && n !== root; n = n.offsetParent) y += n.offsetTop; return y; }

export function attachPreview(root, {enabled, sound}) {
  let scene = null, model = null, busy = false, pressTimer = 0, from = null;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function bannerHTML(b, i) {
    const cost = b.cost ? `<span class="rp-preview-cost">${b.cost.length ? b.cost.map(pipHTML).join('') : '<small>Free</small>'}</span>` : '';
    return `<button type="button" class="rp-preview-banner${b.move ? '' : ' is-off'}" data-rp-preview-act="${i}" style="--banner:${COLOR[b.type] || COLOR.Colorless}"${b.move || b.details ? '' : ' disabled'} aria-label="${esc(b.label)}">`
      + `${cost}<span class="rp-preview-copy"><b>${esc(b.name)}</b>${b.text ? `<small>${esc(b.text)}</small>` : ''}${b.why ? `<em>${esc(b.why)}</em>` : ''}</span>`
      + `${b.damage ? `<strong>${b.damage}</strong>` : ''}</button>`;
  }
  function html(m) {
    const hp = Math.max(0, m.max - m.dmg);
    const retreat = m.retreat ? `<button type="button" class="rp-preview-retreat${m.retreat.enabled ? '' : ' is-off'}" data-rp-preview-retreat${m.retreat.enabled ? '' : ' disabled'} aria-label="${esc(m.retreat.enabled ? `Retreat, costs ${m.retreat.cost} Energy` : `Retreat unavailable${m.retreat.why ? ': ' + m.retreat.why : ''}`)}"><span class="rp-preview-cost">${m.retreat.cost ? Array.from({length:m.retreat.cost}, () => pipHTML('Colorless')).join('') : '<small>Free</small>'}</span><span>${esc(m.retreat.why || 'retreat')}</span></button>` : '';
    return `<div class="rp-preview-stage${m.mine ? ' is-mine' : ' is-theirs'}"><div class="rp-preview-tilt"><div class="rp-preview-card${m.banners.length ? ' has-banners' : ''}">`
      + `<span class="rp-card-print">${m.print}</span>`
      + `<span class="rp-preview-hp" aria-label="${hp} of ${m.max} HP remaining"><b>${hp}</b><i><u style="width:${Math.max(0, Math.min(100, hp / m.max * 100))}%"></u></i></span>`
      + `<span class="rp-preview-energy" aria-label="${m.energy.length} Energy attached">${m.energy.map(e => `<i style="--energy:${COLOR[e] || COLOR.Colorless}" title="${esc(e)} Energy" role="img" aria-label="${esc(e)} Energy">${energySVG(e)}</i>`).join('')}</span>`
      + (m.badges ? `<span class="rp-preview-status">${m.badges}</span>` : '')
      + (m.banners.length ? `<div class="rp-preview-banners">${m.banners.map(bannerHTML).join('')}</div>` : '')
      + retreat + `</div></div>`
      + `<button type="button" class="rp-preview-details" data-rp-preview-details aria-label="Card details for ${esc(m.name)}"><span aria-hidden="true">i</span></button></div>`
      + (m.note ? `<p class="rp-preview-note">${esc(m.note)}</p>` : '')
      + `<p class="rp-sr-only">${esc(m.name)}. Tap outside the card or press Escape to set it down.</p>`;
  }
  function place() {
    const card = scene?.querySelector('.rp-preview-card'), art = card?.querySelector('.pk-c-art'), foot = card?.querySelector('.pk-c-foot');
    if (!card) return;
    const h = card.offsetHeight, banners = card.querySelector('.rp-preview-banners'), retreat = card.querySelector('.rp-preview-retreat');
    if (!h) return;
    // The banners start under the player's picture and never cover it (Nov 7 2026, Evan:
    // "Move the attacks down so it doesn't cut off the player picture"); when they need more room
    // they hang below the card. Retreat sits on the printed footer, or under the banners.
    const top = (art ? offsetIn(art, card) + art.offsetHeight : h * .6) + 6;
    let low = h;
    if (banners) { banners.style.top = top + 'px'; banners.style.bottom = 'auto'; low = Math.max(low, top + banners.offsetHeight); }
    if (retreat) {
      const footTop = h - (foot ? Math.max(0, h - offsetIn(foot, card) - foot.offsetHeight - 6) : h * .02) - retreat.offsetHeight;
      const at = Math.max(footTop, banners ? top + banners.offsetHeight + 6 : top);
      retreat.style.top = at + 'px'; retreat.style.bottom = 'auto'; low = Math.max(low, at + retreat.offsetHeight);
    }
    // Attached Energy moves off the banners: beside Retreat (which leaves the left of its row free), else under them.
    const energy = card.querySelector('.rp-preview-energy');
    if (energy && banners) {
      const at = retreat ? offsetIn(retreat, card) + (retreat.offsetHeight - energy.offsetHeight) / 2 : low + 4;
      energy.style.top = at + 'px'; energy.style.bottom = 'auto'; low = Math.max(low, at + energy.offsetHeight);
    }
    // The stage rises by what hangs below the card so the lowest button stays on screen.
    scene.style.setProperty('--rp-pv-below', Math.ceil(low - h) + 'px');
  }
  function trap(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key !== 'Tab') return;
    const items = [...scene.querySelectorAll('button:not([disabled])')];
    if (!items.length) { e.preventDefault(); return; }
    const i = items.indexOf(document.activeElement), next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
    e.preventDefault(); items[next].focus();
  }
  function click(e) {
    if (!scene || busy) return;
    const act = e.target.closest('[data-rp-preview-act]'), retreat = e.target.closest('[data-rp-preview-retreat]');
    if (e.target.closest('[data-rp-preview-details]')) { const m = model; close(false); m.onDetails(); return; }
    if (act || retreat) {
      const b = act ? model.banners[Number(act.dataset.rpPreviewAct)] : null;
      if (!enabled() || (act && !b?.move && !b?.details) || (retreat && !model.retreat?.enabled)) return;
      if (b?.details) { const m = model; close(false); m.onDetails(); return; }
      // The chosen banner flashes white, then the card is set down and the move is sent.
      busy = true; sound('select'); (act || retreat).classList.add('is-pressed');
      const m = model;
      pressTimer = setTimeout(() => { close(false); if (b) m.onMove(b.move); else m.onRetreat(); }, motion.matches ? 0 : 220);
      return;
    }
    if (!e.target.closest('.rp-preview-card')) close(true);
  }
  function animateFrom(rect) {
    const tilt = scene.querySelector('.rp-preview-tilt'), to = tilt?.getBoundingClientRect();
    if (!rect || !to?.width || motion.matches || !tilt.animate) return;
    const dx = rect.left + rect.width / 2 - (to.left + to.width / 2), dy = rect.top + rect.height / 2 - (to.top + to.height / 2), s = rect.width / to.width;
    scene.querySelector('.rp-preview-stage').animate([{transform:`translate(${dx}px,${dy}px) scale(${s})`}, {transform:'none'}], {duration:260, easing:'cubic-bezier(.2,.9,.3,1.12)'});
    scene.animate([{backgroundColor:'#0f2c4300'}, {backgroundColor:getComputedStyle(scene).backgroundColor}], {duration:200});
  }
  function open(m) {
    close(false);
    if (!m || !enabled()) return false;
    model = m; from = m.from || null; busy = false;
    scene = document.createElement('section');
    scene.className = 'rp-preview';
    scene.setAttribute('role', 'dialog'); scene.setAttribute('aria-modal', 'true'); scene.setAttribute('aria-label', m.name);
    scene.innerHTML = html(m);
    scene.addEventListener('click', click); scene.addEventListener('keydown', trap);
    root.append(scene); place(); animateFrom(from);
    (scene.querySelector('.rp-preview-banner:not([disabled]),.rp-preview-retreat:not([disabled])') || scene.querySelector('[data-rp-preview-details]')).focus({preventScroll:true});
    sound('card');
    return true;
  }
  /** Rebuild in place after the match changes; a missing athlete closes the preview. */
  function refresh(m) {
    if (!scene || busy) return;
    if (!m) { close(false); return; }
    model = {...m, from}; scene.innerHTML = html(model); place();
    (scene.querySelector('.rp-preview-banner:not([disabled]),.rp-preview-retreat:not([disabled])') || scene.querySelector('[data-rp-preview-details]')).focus({preventScroll:true});
  }
  function close(animate) {
    clearTimeout(pressTimer); busy = false;
    const old = scene, m = model; scene = null; model = null;
    if (!old) return;
    const focus = typeof m?.returnFocus === 'function' ? m.returnFocus() : m?.returnFocus;
    if (animate && from && !motion.matches && old.querySelector('.rp-preview-stage')?.animate) {
      old.style.pointerEvents = 'none';
      const tilt = old.querySelector('.rp-preview-tilt').getBoundingClientRect();
      const dx = from.left + from.width / 2 - (tilt.left + tilt.width / 2), dy = from.top + from.height / 2 - (tilt.top + tilt.height / 2), s = from.width / tilt.width;
      old.querySelector('.rp-preview-stage').animate([{transform:'none'}, {transform:`translate(${dx}px,${dy}px) scale(${s})`}], {duration:170, easing:'ease-in', fill:'forwards'});
      old.animate([{opacity:1}, {opacity:0}], {duration:170, easing:'ease-in', fill:'forwards'}).finished.then(() => old.remove(), () => old.remove());
    } else old.remove();
    if (animate && focus?.isConnected) focus.focus({preventScroll:true});
  }
  const visibility = () => { if (document.hidden) close(false); };
  document.addEventListener('visibilitychange', visibility);
  return {
    open, refresh, isOpen: () => !!scene, current: () => model && {side: model.side, u: model.u},
    close: () => close(false),
    stop() { close(false); document.removeEventListener('visibilitychange', visibility); }
  };
}
