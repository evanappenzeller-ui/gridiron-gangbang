// Player picker (spec 7.6): a large sheet with a search field and up to 8 player rows.
// Used by the Mystery player and the Grid inside the run cover. Owner: puzzle-run package.
//
//   openPicker({kind: 'mystery'|'journey'|'grid', title, worth, criteria: [r, c], disabled: i => '' | 'Guessed' | 'On your grid'})
//   ('journey' looks and behaves like 'mystery': a title with the "Worth n" caption and "Guessed" rows.)
//     → Promise<playerIndex | null>
//
// Call it synchronously inside the tap handler: the sheet and its search field are created and focused inside
// the gesture, so iOS raises the keyboard on the first tap. The promise resolves as soon as the sheet starts
// to dismiss (the caller applies the daily action at once); await sheetsGone() before animating the result,
// so the motion is not hidden behind the departing sheet.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as daily from '../core/daily.js';

const esc = data.esc;
const KIND_ICON = {t: 'shield', p: 'figure', d: 'number', c: 'grad-cap'};
/** Criterion icon: team → shield, position → figure, draft → number, college → grad-cap. */
export const critIcon = c => KIND_ICON[daily.critKind(c)] || 'shield';

const MSG_START = 'Start typing a name. Best-known players show first.';
const MSG_NONE = 'No players match. Check the spelling.';

let seq = 0;

/** Resolves once no sheet is left in #overlays (or after `max` ms). */
export function sheetsGone(max = 800) {
  return new Promise(res => {
    const t0 = performance.now();
    const tick = () => {
      const host = document.getElementById('overlays');
      if (!host || !host.querySelector('.sheet') || performance.now() - t0 > max) { res(); return; }
      setTimeout(tick, 16);
    };
    tick();
  });
}

// Per-character normalization of one word (daily.norm rules), keeping a map back to the original characters
// so a matched prefix of the normalized word can be highlighted in the original spelling ("D'Andre", "Jérôme").
function normWord(w) {
  let n = '';
  const at = []; // at[k] = index in w just after the original char that produced normalized char k
  let i = 0;
  for (const ch of w) {
    const s = daily.norm(ch).replace(/ /g, '');
    i += ch.length;
    for (let k = 0; k < s.length; k++) { n += s[k]; at.push(i); }
  }
  return {n, at};
}

/** Name with the matched word prefixes in <b> (ink); the rest stays ink-2. */
function highlight(name, tokens) {
  if (!tokens.length) return esc(name);
  return String(name).split(/(\s+)/).map(part => {
    if (!part || /^\s+$/.test(part)) return esc(part);
    const {n, at} = normWord(part);
    let best = 0;
    tokens.forEach(t => { if (t && n.startsWith(t) && t.length > best) best = t.length; });
    if (!best) return esc(part);
    const cut = at[best - 1] || 0;
    return `<b>${esc(part.slice(0, cut))}</b>${esc(part.slice(cut))}`;
  }).join('');
}

function headerHTML({kind, title, worth, criteria}) {
  if (kind === 'grid' && criteria && criteria.length === 2) {
    const chip = c => `<span class="pk-chip">${ui.icon(critIcon(c))}<span class="pk-cl">${esc(daily.critLabel(c))}</span></span>`;
    return `<div class="pk-crit">${chip(criteria[0])}<span class="pk-x" aria-hidden="true">×</span>${chip(criteria[1])}</div>`;
  }
  const cap = worth != null ? `<span class="pk-cap">Worth <span class="pk-worth">${esc(data.nf(worth))}</span></span>` : '';
  return `<div class="pk-head"><span class="pk-t">${esc(title || 'Name the player')}</span>${cap}</div>`;
}

/**
 * Opens the picker. Resolves the picked player index, or null when it is dismissed (close button, scrim,
 * drag, Esc, Android Back).
 */
export function openPicker(o = {}) {
  const kind = o.kind === 'grid' || o.kind === 'journey' ? o.kind : 'mystery';
  const disabledOf = typeof o.disabled === 'function' ? o.disabled : () => '';
  const uid = 'pk' + (++seq);
  const label = kind === 'grid' && o.criteria && o.criteria.length === 2
    ? `${daily.critLabel(o.criteria[0])} and ${daily.critLabel(o.criteria[1])}`
    : (o.title || 'Name the player');

  return new Promise(resolve => {
    let picked = null, closing = false, hl = -1, rows = [];
    const field = ui.searchField({
      name: 'q', placeholder: "Type a player's name", label: 'Player name',
      attrs: {role: 'combobox', 'aria-expanded': 'false', 'aria-controls': uid + '-list', 'aria-autocomplete': 'list'}
    });
    const body = `<div class="pk-search">${field}</div>`
      + `<div class="pk-list" id="${uid}-list" role="listbox" aria-label="Players"></div>`
      + `<p class="pk-msg" aria-live="polite">${esc(MSG_START)}</p>`;
    const sheet = ui.openSheet({
      header: headerHTML(Object.assign({}, o, {kind})), label, body,
      detents: ['large'], cls: 'sh-picker', focus: 'input',
      onClose: () => { closing = true; resolve(picked); }
    });
    const input = sheet.body.querySelector('input');
    const list = sheet.body.querySelector('.pk-list');
    const msg = sheet.body.querySelector('.pk-msg');

    const setHl = (k, scroll) => {
      hl = k;
      rows.forEach((r, j) => {
        const on = j === k;
        r.el.classList.toggle('is-hl', on);
        r.el.setAttribute('aria-selected', String(on));
      });
      if (k >= 0 && rows[k]) {
        input.setAttribute('aria-activedescendant', rows[k].el.id);
        if (scroll) rows[k].el.scrollIntoView({block: 'nearest'});
      } else input.removeAttribute('aria-activedescendant');
    };
    const firstEnabled = () => rows.findIndex(r => !r.dis);

    const search = () => {
      const q = input.value;
      const tokens = daily.norm(q).split(' ').filter(Boolean);
      const res = tokens.length ? daily.searchPlayers(q, {audienceFirst: kind !== 'grid'}) : [];
      list.innerHTML = res.map((i, n) => {
        const p = daily.PP[i];
        const dis = disabledOf(i) || '';
        const sub = `${p[2]} · ${daily.yrs(i)}`;
        return `<div class="pk-row" role="option" id="${uid}-o${n}" data-pk="${i}" data-press="row" aria-selected="false"${dis ? ' aria-disabled="true"' : ''}>`
          + `<span class="pk-main"><span class="pk-name">${highlight(p[0], tokens)}</span><span class="pk-sub">${esc(sub)}</span></span>`
          + (dis ? `<span class="pk-dis">${esc(dis)}</span>` : '')
          + `</div>`;
      }).join('');
      rows = [...list.children].map(el => ({el, i: +el.dataset.pk, dis: el.getAttribute('aria-disabled') === 'true'}));
      input.setAttribute('aria-expanded', String(rows.length > 0));
      const t = q.trim();
      const text = !t ? MSG_START : (!res.length && t.length > 1 ? MSG_NONE : '');
      if (msg.textContent !== text) msg.textContent = text;
      msg.hidden = !text;
      setHl(firstEnabled(), false);
      sheet.body.scrollTop = 0;
    };

    const pick = row => {
      if (closing || picked != null || !row) return;
      if (row.dis) {
        // Spec 9: the duplicate-guess toasts stay. The sheet stays open so another name can be typed.
        const n = daily.PP[row.i] ? daily.PP[row.i][0] : 'That player';
        ui.toast(kind === 'grid' ? `${n} is already on your grid.` : `You already guessed ${n}.`);
        ui.haptic('warning');
        return;
      }
      picked = row.i;
      ui.haptic('light');
      row.el.classList.add('is-picked');
      setTimeout(() => sheet.close(), ui.RM ? 60 : 120);
    };

    input.addEventListener('input', search);
    input.addEventListener('keydown', e => {
      if (e.isComposing) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!rows.length) return;
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        let k = hl;
        for (let n = 0; n < rows.length; n++) {
          k = k < 0 ? (step > 0 ? 0 : rows.length - 1) : (k + step + rows.length) % rows.length;
          if (!rows[k].dis) break;
        }
        if (rows[k] && !rows[k].dis) setHl(k, true);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const k = hl >= 0 && rows[hl] && !rows[hl].dis ? hl : firstEnabled();
        if (k >= 0) pick(rows[k]);
        else if (rows.length) pick(rows[0]); // every match is already used: say so
      }
    });
    list.addEventListener('click', e => {
      const el = e.target.closest('.pk-row');
      if (el) pick(rows.find(r => r.el === el));
    });
    list.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest('.pk-row');
      const k = el ? rows.findIndex(r => r.el === el) : -1;
      if (k >= 0 && k !== hl && !rows[k].dis) setHl(k, false);
    });
    // Warm the search index while the sheet slides up (a no-op once it exists).
    ui.onIdle(() => { if (!closing) daily.searchPlayers('a'); }, 300);
  });
}
