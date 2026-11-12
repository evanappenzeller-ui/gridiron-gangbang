// Rivals Packs: the same looping, snapping shelf and perspective as Home's game cases (games.js).
// Three copies keep both directions continuous; only the middle copy is exposed to screen readers.
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import {packHTML} from './dynasty-packs.js';
import {packTopPlayers} from './dynasty-pack-preview.js';

export function purchaseHTML(kind) {
  const s = D.mine(), P = D.PACKS[kind];
  const free = s.pk[kind] > 0 || (D.unlimited() && !P.unique) || (kind === D.DAILY_PACK && D.dailyReady(s));
  return `<span>Purchase</span><span class="pk-pack-price">${free ? 'Free' : `${data.nf(P.price)} coins`}</span>`;
}

export function packShelfHTML(kinds, selected, design, renderCard, players) {
  // A display-only strip avoids nested controls and keeps the looping copies out of the tab order.
  const previews = Object.fromEntries(kinds.map(kind => [kind,
    `<section class="pk-pack-preview" aria-hidden="${kind !== selected}" aria-label="Top available players in ${data.esc(D.PACKS[kind].name)}">`
    + '<h2>Top available players</h2><div class="pk-pack-preview-row">'
    + (players?.[kind] || packTopPlayers(kind)).map(c => `<div class="pk-pack-preview-card">${renderCard(c)}<span aria-hidden="true">${data.esc(c.name)}</span></div>`).join('')
    + `</div><p>${kind === 'team' ? 'Across teams · choose at purchase' : 'Possible pulls · not guaranteed'}</p></section>`]));
  const row = clone => kinds.map(kind => `<div class="pk-pack-slot" data-pack-kind="${kind}"${clone ? ' data-pack-clone aria-hidden="true"' : ''}>`
    + previews[kind]
    + `<button type="button" class="pk-pack-choice" tabindex="-1" aria-label="Select ${data.esc(D.PACKS[kind].name)}">${packHTML(kind, {big: true, design: design(kind)})}</button></div>`).join('');
  return `<div class="pk-packs pk-pack-shop" style="--pc:${D.PACKS[selected].color}">`
    + '<div class="pk-pack-studio" aria-hidden="true"></div>'
    + '<div class="pk-pack-stage"><div class="pk-pack-shelf" role="region" aria-roledescription="carousel" aria-label="Booster packs: swipe or use the left and right arrow keys" tabindex="0">'
    + row(true) + row(false) + row(true) + '</div></div>'
    + '<span class="sr-only" aria-live="polite" data-pack-say></span>'
    + `<div class="pk-pack-checkout"><button type="button" class="pk-pack-buy" data-dy-openhere aria-label="Purchase ${data.esc(D.PACKS[selected].name)}">${purchaseHTML(selected)}</button></div></div>`;
}

export function mountPackShelf(root, selected, {onSelect, onRest}) {
  const shelf = root.querySelector('.pk-pack-shelf'), slots = [...shelf.children], n = slots.length / 3;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = n + slots.slice(0, n).findIndex(s => s.dataset.packKind === selected);
  let width = shelf.clientWidth, height = shelf.clientHeight;
  let frame = 0, snapFrame = 0, timer = 0, dead = false, touching = false, moving = false, drag = null, blockedUntil = 0;
  const listeners = [];
  const listen = (el, event, fn, options) => { el.addEventListener(event, fn, options); listeners.push(() => el.removeEventListener(event, fn, options)); };
  function layout() {
    frame = 0;
    if (dead || !shelf.clientWidth) return;
    // A browser can dispatch scroll/scrollend for its resize anchoring before ResizeObserver.
    // Keep the selected pack instead of treating that temporary position as a swipe.
    if (width !== shelf.clientWidth || height !== shelf.clientHeight) { resizeToSelection(); return; }
    const mid = shelf.scrollLeft + shelf.clientWidth / 2;
    // Use the untransformed slot centers so the tilt never moves its own snap target.
    const ds = slots.map(s => (s.offsetLeft + s.offsetWidth / 2 - mid) / s.offsetWidth);
    let best = cur, distance = Infinity;
    slots.forEach((slot, i) => {
      const d = Math.abs(ds[i]) < .02 ? 0 : ds[i], k = Math.min(1, Math.abs(d));
      slot.style.setProperty('--k', k.toFixed(3));
      slot.style.setProperty('--d', Math.max(-1.5, Math.min(1.5, d)).toFixed(3));
      slot.classList.toggle('is-cur', k < .5);
      slot.classList.toggle('is-far', Math.abs(d) > 2.2);
      if (Math.abs(d) < distance) { distance = Math.abs(d); best = i; }
    });
    cur = best;
    const kind = slots[cur].dataset.packKind;
    slots.forEach(s => {
      const b = s.querySelector('.pk-pack-choice'), on = s.dataset.packKind === kind;
      b.tabIndex = on && !s.hasAttribute('data-pack-clone') ? 0 : -1;
      b.setAttribute('aria-pressed', String(on));
      s.querySelector('.pk-pack-preview').setAttribute('aria-hidden', String(!on || s.hasAttribute('data-pack-clone')));
    });
    if (kind !== selected) {
      selected = kind;
      root.style.setProperty('--pc', D.PACKS[kind].color);
      const buy = root.querySelector('.pk-pack-buy');
      buy.innerHTML = purchaseHTML(kind);
      buy.setAttribute('aria-label', `Purchase ${D.PACKS[kind].name}`);
      onSelect(kind);
    }
  }
  function jump(left) {
    cancelAnimationFrame(snapFrame);
    shelf.style.scrollSnapType = 'none';
    shelf.scrollLeft = left;
    void shelf.scrollLeft;
    snapFrame = requestAnimationFrame(() => { snapFrame = 0; if (!dead) shelf.style.scrollSnapType = ''; });
  }
  function settle() {
    clearTimeout(timer);
    if (dead || touching || !shelf.clientWidth) return;
    layout();
    if (cur < n || cur >= n * 2) {
      const to = n + cur % n;
      jump(shelf.scrollLeft + slots[to].offsetLeft - slots[cur].offsetLeft);
      cur = to;
      layout();
    }
    moving = false;
    root.querySelector('[data-pack-say]').textContent = `${D.PACKS[selected].name}, pack ${cur % n + 1} of ${n}`;
    onRest();
  }
  function center(index, smooth = true) {
    cur = Math.max(0, Math.min(slots.length - 1, index));
    const slot = slots[cur], left = slot.offsetLeft + slot.offsetWidth / 2 - shelf.clientWidth / 2;
    if (smooth && !reduced()) { moving = true; shelf.scrollTo({left, behavior: 'smooth'}); }
    else { jump(left); layout(); }
    clearTimeout(timer); timer = setTimeout(settle, 180);
  }
  listen(shelf, 'scroll', () => {
    moving = true;
    if (!frame) frame = requestAnimationFrame(layout);
    clearTimeout(timer); timer = setTimeout(settle, 160);
  }, {passive: true});
  listen(shelf, 'scrollend', settle);
  listen(shelf, 'pointerdown', e => {
    if (e.button !== 0 || e.isPrimary === false) return;
    touching = true;
    drag = {id: e.pointerId, x: e.clientX, left: shelf.scrollLeft, mouse: e.pointerType === 'mouse', moved: false};
  }, {passive: true});
  listen(shelf, 'pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 8) drag.moved = true;
    if (!drag.mouse || !drag.moved) return;
    e.preventDefault();
    shelf.setPointerCapture(e.pointerId);
    shelf.style.scrollSnapType = 'none';
    shelf.scrollLeft = drag.left - dx;
  });
  const up = e => {
    if (!drag || drag.id !== e.pointerId) return;
    const {mouse, moved} = drag;
    touching = false; drag = null;
    if (moved) blockedUntil = performance.now() + 450;
    if (mouse && moved) { layout(); shelf.style.scrollSnapType = ''; center(cur); }
    clearTimeout(timer); timer = setTimeout(settle, 180);
  };
  listen(window, 'pointerup', up, {passive: true});
  listen(window, 'pointercancel', up, {passive: true});
  listen(shelf, 'click', e => {
    const slot = e.target.closest('.pk-pack-slot');
    if (!slot || performance.now() < blockedUntil) return;
    // A pack tap selects it. Only the Purchase button opens a pack.
    shelf.focus({preventScroll: true});
    center(slots.indexOf(slot));
  });
  listen(shelf, 'keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    shelf.focus({preventScroll: true});
    center(e.key === 'Home' ? n : e.key === 'End' ? n * 2 - 1 : cur + (e.key === 'ArrowLeft' ? -1 : 1));
  });
  function resizeToSelection() {
    if (dead || !shelf.clientWidth) return;
    width = shelf.clientWidth; height = shelf.clientHeight;
    center(n + slots.slice(0, n).findIndex(s => s.dataset.packKind === selected), false);
  }
  const resize = new ResizeObserver(() => {
    if (width !== shelf.clientWidth || height !== shelf.clientHeight) resizeToSelection();
  });
  resize.observe(shelf);
  center(cur, false);
  return {
    get busy() { return touching || moving; },
    destroy() {
      dead = true; resize.disconnect(); listeners.forEach(stop => stop());
      clearTimeout(timer); cancelAnimationFrame(frame); cancelAnimationFrame(snapFrame);
    }
  };
}
