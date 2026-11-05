import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as D from '../core/dynasty.js';
import * as T from '../core/dynasty-table.js';
const esc = data.esc;

export function tableOptions(onChange = () => {}) {
  if (!D.tableOpen()) return;
  const body = () => `<p class="pk-note">Your felt takes over on your turn. Your opponent’s felt appears on theirs. Finish challenges or open packs to unlock more.</p><div class="rt-finishes">${D.tableFinishes().map(f => `<button type="button" data-rt-finish="${f.id}" class="rt-finish" aria-pressed="${D.tableFinish().id === f.id}" ${f.unlocked ? '' : 'disabled'}><span style="--felt:${f.color};--away:${f.away}"></span><b>${esc(f.name)}</b><small>${f.unlocked ? D.tableFinish().id === f.id ? 'Equipped' : 'Equip finish' : `${esc(f.rule)} · ${f.have}/${f.goal}`}</small></button>`).join('')}</div>`;
  const sh = ui.openSheet({title: 'Your table', body: body(), cls: 'pk-sheet', detents: ['large']});
  sh.body.addEventListener('click', e => {
    const b = e.target.closest('[data-rt-finish]');
    if (b && D.setTableFinish(b.dataset.rtFinish)) { sh.body.innerHTML = body(); ui.haptic('selection'); onChange(); }
  });
}

export function tableDeckSheet(onChange = () => {}) {
  if (!D.tableOpen()) return;
  const s = D.mine(), pool = T.available(s);
  let draft = D.tableDeck(s).ids.slice(), filter = '';
  const rows = () => Object.keys(pool).filter(id => D.anyCard(id) && (D.anyCard(id).name.toLowerCase().includes(filter.toLowerCase())))
    .sort((a, b) => (draft.includes(b) - draft.includes(a)) || D.anyCard(a).name.localeCompare(D.anyCard(b).name)).map(id => {
      const c = D.anyCard(id), count = draft.filter(x => x === id).length, cap = Math.min(2, pool[id]);
      return `<div class="rt-deck-row"><div><b>${esc(c.name)}</b><small>${T.PLAYBOOK[id] ? 'Match playbook · reusable' : c.pos ? `${esc(c.pos)} · ${c.o} OVR` : esc(c.kind)}${c.text ? ` · ${esc(c.text)}` : ''}</small></div><button type="button" data-rt-minus="${esc(id)}" aria-label="Remove ${esc(c.name)}" ${count ? '' : 'disabled'}>−</button><b>${count}</b><button type="button" data-rt-plus="${esc(id)}" aria-label="Add ${esc(c.name)}" ${count < cap && draft.length < T.SIZE ? '' : 'disabled'}>+</button></div>`;
    }).join('');
  const sh = ui.openSheet({title: 'Solo table deck', body: `<p class="pk-note">40 cards. At least 6 players. Up to 2 copies of cards you own. Eight reusable ability cards come with the match playbook. Editing applies to your next solo match.</p><div class="rt-deck-tools"><b data-rt-count></b><button class="pk-btn" data-rt-auto>Build from my deck</button><button class="pk-btn is-go" data-rt-save>Save deck</button></div><label class="rt-search">Find a card<input type="search" placeholder="Player or ability" data-rt-search></label><div data-rt-rows></div>`, cls: 'pk-sheet', detents: ['large']});
  const draw = () => {
    const r = T.check(draft, s);
    sh.body.querySelector('[data-rt-count]').textContent = `${draft.length}/40 · ${r.ok ? 'Ready' : r.why}`;
    sh.body.querySelector('[data-rt-save]').disabled = !r.ok;
    sh.body.querySelector('[data-rt-rows]').innerHTML = rows();
  };
  sh.body.addEventListener('input', e => { if (e.target.matches('[data-rt-search]')) { filter = e.target.value; draw(); } });
  sh.body.addEventListener('click', e => {
    let b;
    if ((b = e.target.closest('[data-rt-minus]'))) { const i = draft.indexOf(b.dataset.rtMinus); if (i >= 0) draft.splice(i, 1); draw(); }
    if ((b = e.target.closest('[data-rt-plus]'))) { const id = b.dataset.rtPlus; if (draft.length < T.SIZE && draft.filter(x => x === id).length < Math.min(2, pool[id] || 0)) draft.push(id); draw(); }
    if (e.target.closest('[data-rt-auto]')) { draft = T.build(s); draw(); }
    if (e.target.closest('[data-rt-save]')) { const r = D.setTableDeck(draft, s); if (r.ok) { sh.close(); ui.toast('Solo deck saved', {icon: 'check-circle'}); onChange(); } else ui.toast(r.why); }
  });
  draw();
}
