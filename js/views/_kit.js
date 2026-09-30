// Dev component gallery at #/_kit (not linked anywhere). Owner: foundation (shell).
// Renders every ui.js primitive on real league data, plus the Core checks panel.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import {runChecks} from '../core/checks.js';

const esc = data.esc;
const sec = (title, inner, {note, id} = {}) => `<section class="kit-sec"${id ? ` id="${id}"` : ''}>${ui.sectionHeader({title})}${inner}${note ? `<p class="note">${esc(note)}</p>` : ''}</section>`;
const demoBtn = (demo, label, kind = 'secondary', extra = {}) => ui.button(Object.assign({label, kind, size: 's', attrs: {'data-demo': demo}}, extra));

let replay = 0;
let ringState = 0;
let odoVal = 6;

function games() {
  const G = data.GAMES;
  const finals = G.filter(g => g.type === 'final');
  const decided = G.filter(g => !g.tie);
  const blow = decided.reduce((m, g) => g.margin > m.margin ? g : m, decided[0]);
  const nail = decided.reduce((m, g) => g.margin < m.margin ? g : m, decided[0]);
  const tie = G.find(g => g.tie) || null;
  return {final: finals[finals.length - 1], blow, nail, tie, reg: G.filter(g => g.reg).slice(-4)};
}

function routeRows() {
  const y = (data.DONE[0] && data.DONE[0].year) || data.span.last || 2025;
  const live = (data.SEASONS.find(s => s.live) || {}).year;
  const R = [
    ['/today', 'root · Today'], ['/today/play/college', 'cover · run'], ['/today/play/silhouette', 'cover · run (five-puzzle days)'], ['/today/play/mystery', 'cover · run'], ['/today/play/journey', 'cover · run (five-puzzle days)'], ['/today/play/grid', 'cover · run'], ['/today/results', 'cover · results'],
    ['/standings', 'root · Standings'], [`/standings/${y}`, 'push · season'], [`/standings/${y}/weeks`, 'push · season'], [`/standings/${y}/weeks/7`, 'push · season'], [`/standings/${y}/bracket`, 'push · season'], [`/standings/${y}/review`, 'push · review'],
    ...(live ? [[`/standings/${live}`, 'push · season in progress'], [`/standings/${live}/wrap/1`, 'push · wrap']] : []),
    [`/standings/${y}/wrap/16`, 'push · wrap (playoff week)'], [`/standings/${y}/wrap/99`, 'push · wrap (no such week)'],
    ['/rivals', 'root · Rivals'], ['/rivals/evan-vs-mason', 'root · Rivals pair'], ['/rivals?s=pickem', "root · Rivals, NFL Pick'em card"],
    ['/pickem', "push · NFL Pick'em (this week)"], ['/pickem?week=3', "push · NFL Pick'em, week 3 (read-only)"], ['/pickem?week=18', "push · NFL Pick'em, future week → redirect"],
    ['/press', 'push · Press Room'], ['/press/2026-w2', 'push · Press Room, one week (share link)'], ['/press/foo', 'push · Press Room, unknown week → archive + toast'],
    ['/hall', 'redirect → /hall/trophies'], ['/hall/trophies', 'root · Hall'], ['/hall/records', 'root · Hall'], ['/hall/records/2.4', 'root · Hall focus'], ['/hall/shame', 'root · Hall Shame'], [`/hall/shame?y=${live || y}`, 'root · Hall Shame, one season'],
    ['/moves', 'redirect → /moves/drafts'], ['/moves/drafts', 'root · Moves'], ['/moves/drafts/2024?m=evan', 'root · Moves filtered'], ['/moves/trades?m=ben', 'root · Moves trades'],
    ['/managers/evan', 'push · profile'], ['/managers/nobody', 'push · unknown manager'], ['/_kit', 'push · this gallery'], ['/not-a-route', 'unknown → toast']
  ];
  return ui.group(R.map(([p, s]) => ui.row({title: p, sub: s, chevron: true, attrs: {'data-nav': p}})).join(''));
}

function avatarsSection() {
  const ids = data.ids;
  const grid = `<div class="kit-avgrid">${ids.map(id => `<div class="kit-av"><div class="kit-avrow">${ui.avatar(id, {size: 40, label: true})}${ui.avatar(id, {size: 40, hero: true})}${ui.avatar(id, {size: 40, you: true})}${ui.avatar(id, {size: 40, champ: true, crown: true})}</div><span class="t-foot ink2">${esc(data.name(id))}</span></div>`).join('')}</div>`;
  const sizes = `<div class="kit-wrap kit-sizes">${[20, 24, 28, 32, 36, 40, 56, 72, 96].map(s => `<div class="kit-cell">${ui.avatar('evan', {size: s, hero: s >= 72, crown: s === 96})}<span class="t-cap ink3">${s}</span></div>`).join('')}</div>`;
  const neutral = `<div class="kit-wrap">${ui.nickAvatar('Stranger Danger', {size: 40})}${ui.nickAvatar('q', {size: 40})}${ui.nickAvatar('Mason 2', {size: 40, managerId: 'mason'})}${ui.nickAvatar('Nobody', {size: 36, you: true})}${ui.avatar('unknown-id', {size: 40})}${ui.avatar('zed', {size: 40, hero: true})}</div>`;
  const stack = `<div class="kit-wrap">${ui.avatarStack(ids.slice(0, 3))}${ui.avatarStack(ids, {max: 5})}${ui.avatarStack([{nick: 'Stranger'}, {id: 'evan', you: true}, 'mason'], {size: 28})}</div>`;
  return sec('Avatars', `<p class="t-foot ink3 kit-cap">Default · hero · you ring · champion ring + crown</p>${grid}<p class="t-foot ink3 kit-cap">Sizes</p>${sizes}<p class="t-foot ink3 kit-cap">Neutral nicks, fallback ids, stacks</p>${neutral}${stack}`);
}

function typeSection() {
  const T = [['n-hero', '1,000'], ['n1', '64'], ['n2', '48'], ['n3', raw(ui.score(1532.1))], ['n4', raw(ui.score(132.46))], ['n5', '1.07'], ['ovl', 'WEEK 7 · FINAL'],
    ['t-large', 'Large title'], ['t-1', 'Title 1'], ['t-2', 'Title 2'], ['t-3', 'Title 3'], ['t-headline', 'Headline'], ['t-body', 'Body text'], ['t-callout', 'Callout'], ['t-sub', 'Subhead'], ['t-foot', 'Footnote'], ['t-cap', 'Caption']];
  return sec('Type', `<div class="card kit-type">${T.map(([c, s]) => `<div class="kit-typerow"><span class="${c}">${s && s.__html != null ? s.__html : esc(s)}</span><span class="t-cap ink3">.${c}</span></div>`).join('')}</div>`);
}
function raw(h) { return {__html: h}; }

function buttonsSection() {
  const L = ['primary', 'secondary', 'plain', 'destructive', 'destructive-fill'];
  return sec('Buttons', `
    <div class="vstack">${ui.button({label: 'Start today’s three', kind: 'primary'})}${ui.button({label: 'Resume · Grid', kind: 'secondary', icon: 'grid-3'})}
    ${ui.button({label: 'Loading', kind: 'primary', loading: true})}${ui.button({label: 'Disabled', kind: 'primary', disabled: true})}
    ${ui.button({label: 'Toggle loading on me', kind: 'secondary', attrs: {'data-demo': 'loading'}})}</div>
    <div class="kit-wrap mt-16">${L.map(k => ui.button({label: k, kind: k, size: 's'})).join('')}${ui.button({label: 'Disabled', kind: 'secondary', size: 's', disabled: true})}</div>
    <div class="kit-wrap mt-12">${ui.iconButton({icon: 'share', label: 'Share'})}${ui.iconButton({icon: 'sort', label: 'Sort'})}${ui.iconButton({icon: 'close', label: 'Close', filled: true})}${ui.iconButton({icon: 'gear', label: 'Settings', disabled: true})}</div>`);
}

function badgesSection() {
  const K = [['champ'], ['2nd'], ['3rd'], ['playoffs'], ['missed'], ['last'], ['bye'], ['qf'], ['sf'], ['consol'], ['final'], ['progress'], ['blowout'], ['nail'], ['high'], ['you'], ['deep']];
  return sec('Badges and pills', `<div class="kit-wrap">${K.map(k => ui.badge(k[0])).join('')}${ui.badge('champion')}${ui.badge('runnerUp')}${ui.badge('progress', 'IN PROGRESS · THROUGH WK 2')}</div>
    <div class="kit-wrap mt-16">${ui.pill('DEF')}${ui.pill('640 pts', {tone: 'tint'})}${ui.pill('Perfect', {tone: 'gold', icon: 'star'})}${ui.pill('✕ Josh Allen', {tone: 'wrong'})}${ui.pill('6', {icon: 'flame', large: true})}${ui.pill('Evan', {lead: ui.avatar('evan', {size: 20})})}</div>`);
}

function controlsSection() {
  const years = data.SEASONS.map(s => ({id: s.year, label: String(s.year), dot: s.live}));
  return sec('Controls', `
    ${ui.seg({name: 'kit-seg', items: [{id: 'table', label: 'Table'}, {id: 'weeks', label: 'Weeks'}, {id: 'bracket', label: 'Bracket'}], value: 'table'})}
    <div class="kit-wrap mt-12">${ui.seg({name: 'kit-seg-s', small: true, items: [{id: 'today', label: 'Today'}, {id: 'season', label: 'Season'}, {id: 'streaks', label: 'Streaks'}], value: 'today'})}</div>
    <div class="mt-12">${ui.chips({name: 'kit-years', items: years, value: years[1] ? years[1].id : ''})}</div>
    <div class="mt-4">${ui.chips({name: 'kit-mgr', items: [{id: 'all', label: 'All'}].concat(data.ids.map(id => ({id, label: data.name(id), lead: ui.avatar(id, {size: 24})}))), value: 'all'})}</div>
    <div class="card mt-12 kit-switch">${ui.row({title: 'Haptics', trail: ui.switchCtl({name: 'kit-switch', checked: true, label: 'Haptics'})})}</div>
    <div class="mt-12">${ui.searchField({name: 'kit-q', placeholder: 'Search players'})}</div>
    <p class="note" data-kit-change>Last ui:change: none yet.</p>`);
}

function cardsSection() {
  const at = data.AT.slice().sort((a, b) => b.pct - a.pct).slice(0, 5);
  const me = data.me();
  const rows = at.map((x, i) => ui.row({
    lead: `<span class="n5 ink3 kit-rank">${i + 1}</span>${ui.avatar(x.id, {size: 40})}`,
    title: data.name(x.id), sub: data.team(x.id),
    trail: `<span class="kit-trail"><span class="n4">${data.pct(x.pct)}</span><span class="t-cap ink3">${data.recStr(x.w, x.l, x.t)}</span></span>`,
    chevron: true, key: x.id, me: x.id === me, attrs: {'data-nav': '/managers/' + x.id}
  })).join('');
  return sec('Cards and rows', `
    <div class="accessory">${ui.chips({name: 'kit-acc', items: [{id: 'a', label: 'Sticky accessory'}, {id: 'b', label: 'Pins under the nav'}, {id: 'c', label: 'Within this section'}], value: 'a'})}</div>
    <button type="button" class="card mt-8"><p class="card-ovl">Record of the day</p><p class="card-title">Most points in a season</p><p class="card-body">Tap me: cards scale to .97 on press.</p>${ui.icon('chevron-right', {cls: 'chev'})}</button>
    <div class="card card-hero"><p class="card-ovl">Hero card</p><p class="card-title">Radius 24, padding 20</p></div>
    <div class="mt-16">${ui.group(rows, {header: 'All-time (real data)', footer: 'Rows: avatar 40 → 72 tall. Tap to push a profile.'})}</div>
    <div class="mt-16">${ui.group(ui.row({title: 'One-line row'}) + ui.row({title: 'Selected row', sub: 'Tint leading bar', selected: true}) + ui.row({title: 'Your row', sub: 'is-me', me: true, lead: ui.avatar('evan', {size: 36, you: true})}) + ui.row({title: 'Disabled row', sub: 'opacity .45', disabled: true, chevron: true}) + ui.row({title: 'Long emoji team: Tuten and Fannin it💨 and The King & The Cook 👑🧑🏿‍🍳', sub: 'Edik Lester Bomb Squad 💣 · ellipsis never breaks', trail: ui.badge('champ'), chevron: true, attrs: {'data-x': ''}}))}</div>`);
}

function tilesSection() {
  const x = data.AT.find(a => a.id === 'evan') || data.AT[0];
  const k = 'kit-' + replay;
  return sec('Stat tiles', `<div class="tiles" data-kit-tiles>
      ${ui.statTile({label: 'Titles', countTo: x.titles, key: k + 't'})}
      ${ui.statTile({label: 'Record', value: data.recStr(x.w, x.l, x.t), sub: 'Regular season'})}
      ${ui.statTile({label: 'Win %', countTo: x.pct, format: 'pct', key: k + 'p'})}
      ${ui.statTile({label: 'Pts/game', countTo: Math.round(x.ppg * 10) / 10, format: 'dec1', key: k + 'g', sub: 'All-time'})}
    </div>
    <div class="tiles tiles-3 mt-8">${ui.statTile({label: 'Playoff trips', countTo: x.po, key: k + 'o'})}${ui.statTile({label: 'Runner-ups', countTo: x.seconds, key: k + 's'})}${ui.statTile({label: 'Points for', countTo: Math.round(x.pf * 100) / 100, format: 'score', key: k + 'f'})}</div>
    <div class="kit-wrap mt-12">${demoBtn('tiles', 'Replay count-ups')}</div>`, {note: 'Count-ups start at 60% visibility, once per key per session.'});
}

function bugsSection() {
  const g = games();
  const s = data.seasonByYear(g.final.year);
  const seeds = s ? Object.fromEntries(s.table.map(r => [r.id, r.seed])) : null;
  const h = data.h2hC('evan', 'mason');
  const meets = h.games.slice(-4).reverse();
  return sec('Score bugs', `
    ${ui.scoreBug(g.final, {card: true, teams: true, seeds, footer: `${g.final.year} · CHAMPIONSHIP · WEEK ${g.final.week}`, badges: [['final']], attrs: {'data-demo': 'bug'}})}
    ${ui.scoreBug(g.blow, {card: true, teams: true, footer: true, badges: ['blowout', 'high']})}
    ${ui.scoreBug(g.nail, {card: true, teams: true, footer: true, badges: ['nail']})}
    ${g.tie ? ui.scoreBug(g.tie, {card: true, teams: true, footer: 'TIE'}) : ''}
    <div class="mt-12">${ui.group(g.reg.map(x => ui.scoreBug(x, {teams: true, footer: true})).join(''), {header: 'Row variant (.bug-row)'})}</div>
    <div class="mt-12">${ui.group(meets.map(x => ui.scoreBug(x, {compact: true, a: 'evan'})).join(''), {header: 'Compact (.bug-compact), Evan on side A'})}</div>
    <div class="card mt-12">${ui.scoreBug(g.final, {hero: true, teams: true})}</div>`);
}

function tapeSection() {
  const h = data.h2hC('evan', 'jacob');
  const n = h.games.length || 1;
  const f = v => ui.raw(ui.score(v));
  const share = (h.aw + h.t / 2) / n;
  return sec('Tape and split', `<div class="card">
      ${ui.tape({label: 'Total points', a: f(h.ap), b: f(h.bp), better: h.ap >= h.bp ? 'a' : 'b', aId: 'evan', bId: 'jacob'})}
      ${ui.tape({label: 'Average score', a: f(h.ap / n), b: f(h.bp / n), better: h.ap >= h.bp ? 'a' : 'b', aId: 'evan', bId: 'jacob'})}
      ${ui.tape({label: 'Biggest win', a: h.aBig ? f(h.aBig.m) : '—', b: h.bBig ? f(h.bBig.m) : '—', aSub: h.aBig ? `${h.aBig.g.year}, wk ${h.aBig.g.week}` : '', bSub: h.bBig ? `${h.bBig.g.year}, wk ${h.bBig.g.week}` : '', better: (h.aBig ? h.aBig.m : 0) >= (h.bBig ? h.bBig.m : 0) ? 'a' : 'b', aId: 'evan', bId: 'jacob'})}
      <div class="mt-16" data-kit-split>${ui.splitBar('evan', 'jacob', share)}</div>
      <div class="mt-12">${ui.splitBar('evan', 'mason', .62)}</div>
      <p class="note">Evan vs Mason: violet and periwinkle are within 35°, so side B is drawn in ink.</p>
      <div class="kit-wrap mt-12">${demoBtn('split', 'Re-split')}</div>
    </div>`);
}

function ringSection() {
  const states = [
    [[{frac: 0}, {frac: 0}, {frac: 0}], 'Not started'],
    [[{frac: .6}, {frac: 0}, {frac: .33}], 'In progress'],
    [[{frac: 1, perfect: true}, {frac: 0, doneZero: true}, {frac: .78}], 'Perfect / 0 pts / 350'],
    [[{frac: 1, perfect: true}, {frac: 1, perfect: true}, {frac: 1, perfect: true}], 'Perfect day']
  ];
  return sec('Three-arc ring', `
    <div class="card kit-ringhub">${ui.ring([{frac: .6}, {frac: 1}, {frac: .44}], {center: `<span class="n2" data-kit-ringtotal>610</span><span class="t-foot ink3">of 1,000</span>`, label: 'Today: 610 of 1,000', cls: 'kit-ring-main'})}
      <div class="kit-wrap mt-16">${demoBtn('ring-zero', 'Fill from zero', 'primary')}${demoBtn('ring-rand', 'Random')}${demoBtn('ring-perfect', 'Perfect')}</div></div>
    <div class="kit-wrap kit-rings mt-12">${states.map(([p, l]) => `<div class="kit-cell">${ui.ring(p, {size: 72, stroke: 7})}<span class="t-cap ink3">${esc(l)}</span></div>`).join('')}</div>
    <div class="kit-wrap kit-rings mt-12">${states.map(([p]) => ui.ring(p, {mini: true})).join('')}${ui.ring([{frac: .6}, {frac: 1}, {frac: .44}], {size: 220, stroke: 14, center: '<span class="n1">610</span>'})}</div>`);
}

function motionSection() {
  return sec('Motion', `
    <div class="card vstack">
      <div class="kit-demo"><span class="n2" data-kit-count>1,000</span>${demoBtn('count', 'Count up')}</div>
      <div class="kit-demo"><span class="kit-odo n1" data-kit-odo>${odoVal}</span><span class="t-sub ink2">day streak</span><span class="kit-sp"></span>${demoBtn('odo-up', '+1')}${demoBtn('odo-down', '−1')}</div>
      <div class="kit-demo">${ui.pill('0 pts', {cls: 'kit-pts', large: true})}${demoBtn('float', '+40 float')}${demoBtn('shake', 'Shake', 'destructive')}</div>
      <div class="kit-demo"><div class="kit-flip" data-kit-flip><span class="t-headline">Tap flip</span></div>${demoBtn('flip-y', 'Flip Y')}${demoBtn('flip-x', 'Flip X')}</div>
      <div class="kit-demo"><span class="kit-stamp" data-kit-stamp>5 FOR 5</span>${ui.badge('deep')}${demoBtn('stamp', 'Stamp')}${demoBtn('confetti', 'Confetti', 'primary')}</div>
    </div>
    <div class="mt-12">${ui.group(data.ids.slice(0, 5).map(id => ui.row({lead: ui.avatar(id, {size: 32}), title: data.name(id), key: id, attrs: {'data-enter': ''}})).join(''), {cls: 'kit-flipgroup'})}</div>
    <div class="kit-wrap mt-12">${demoBtn('flip-list', 'FLIP shuffle')}${demoBtn('stagger', 'Stagger')}</div>`);
}

function overlaysSection() {
  return sec('Sheets, toasts, haptics', `<div class="kit-wrap">
      ${demoBtn('sheet-medium', 'Medium sheet', 'primary')}${demoBtn('sheet-large', 'Large sheet + input')}${demoBtn('sheet-fit', 'Fit sheet')}
      ${demoBtn('action', 'Confirm sheet')}${demoBtn('pick', 'Pick manager')}${demoBtn('sort', 'Sort sheet')}
      ${demoBtn('toast', 'Toast')}${demoBtn('toast-act', 'Toast + action')}${demoBtn('announce', 'Announce')}
      ${['selection', 'light', 'medium', 'success', 'warning', 'error', 'celebrate'].map(h => demoBtn('haptic', h, 'plain', {attrs: {'data-demo': 'haptic', 'data-kind': h}})).join('')}
    </div><p class="note" data-kit-result>Results show here.</p>`);
}

function statesSection() {
  return sec('Skeletons and empty states', `
    ${ui.skeleton('title')}<div class="mt-12">${ui.skeleton('rows', 3, {label: 'Loading scores.'})}</div>
    <div class="mt-12">${ui.skeleton('tiles', 2)}</div><div class="mt-12">${ui.skeleton('ring')}</div><div class="mt-12">${ui.skeleton('lines', 3)}</div>
    <div class="card mt-12">${ui.empty({icon: 'football', title: 'Puzzles need a connection the first time.', body: 'League history works offline.', action: {label: 'Try again', attrs: {'data-demo': 'toast'}}})}</div>`);
}

function iconsSection() {
  return sec('Icons', `<div class="kit-icons">${ui.ICON_NAMES.map(n => `<div class="kit-icon">${ui.icon(n)}<span class="t-cap ink3">${esc(n)}</span></div>`).join('')}${['list-number-fill', 'versus-fill', 'trophy-fill', 'swap-fill'].map(n => `<div class="kit-icon tint">${ui.icon(n)}<span class="t-cap ink3">${esc(n)}</span></div>`).join('')}</div>`);
}

function checksSection() {
  return sec('Core checks', `<div data-kit-checks>${ui.skeleton('rows', 4, {label: 'Running checks.'})}</div>`, {id: 'kit-checks'});
}

async function renderChecks(el) {
  const box = el.querySelector('[data-kit-checks]');
  if (!box) return;
  let res;
  try { res = await runChecks(); } catch (e) { res = [{name: 'runChecks()', pass: false, detail: 'threw: ' + (e && e.message || e)}]; }
  if (!box.isConnected) return;
  const ok = res.filter(r => r.pass).length;
  box.innerHTML = `<p class="t-sub ${ok === res.length ? 'tint' : 'wrong'} kit-sum" data-kit-summary>${ok} of ${res.length} passed</p>` +
    ui.group(res.map(r => ui.row({title: ui.raw(`<span class="kit-check">${esc(r.name)}</span>`), sub: String(r.detail || ''), trail: ui.pill(r.pass ? 'PASS' : 'FAIL', {tone: r.pass ? 'tint' : 'wrong'}), cls: 'kit-checkrow'})).join(''));
}

function sheetDemo(kind, out) {
  if (kind === 'sheet-medium') {
    ui.openSheet({title: 'Medium sheet', detents: ['medium', 'large'], cls: 'sh-kit', onClose: () => { out.textContent = 'Medium sheet closed.'; },
      body: `<p class="t-sub ink2">Drag the grabber or header. Drag the content down from the top. Fling to dismiss. Drag up to expand to large (rubber band past the top).</p>
        <div class="mt-16">${ui.group(data.ids.map(id => ui.row({lead: ui.avatar(id, {size: 36}), title: data.name(id), sub: data.team(id), chevron: true, attrs: {'data-sheet-close': ''}})).join(''))}</div>`});
  } else if (kind === 'sheet-large') {
    const s = ui.openSheet({title: 'Name the player', detents: ['large'], cls: 'sh-kit', focus: 'input', onClose: () => { out.textContent = 'Large sheet closed.'; },
      body: `${ui.searchField({name: 'kit-sheet-q', placeholder: "Type a player's name"})}<p class="note">The input was focused synchronously in the tap handler (iOS raises the keyboard). The sheet follows visualViewport resize and scroll.</p>
        <div class="mt-12">${ui.group(Array.from({length: 14}, (_, i) => ui.row({title: 'Result row ' + (i + 1), sub: 'WR · 2014–2023'})).join(''))}</div>`});
    s.body.querySelector('input').addEventListener('input', e => { out.textContent = 'Typed: ' + e.target.value; });
  } else {
    ui.openSheet({title: 'Fit sheet', detents: ['fit'], cls: 'sh-kit', onClose: () => { out.textContent = 'Fit sheet closed.'; },
      body: `<p class="t-sub ink2">Sized to its content.</p><div class="mt-16">${ui.button({label: 'Done', kind: 'primary', attrs: {'data-sheet-close': ''}})}</div>`});
  }
}

export default {
  id: '_kit',
  title: 'Kit',
  actions: () => [{id: 'checks', icon: 'check-circle', label: 'Jump to core checks'}, {id: 'top', icon: 'arrow-up', label: 'Scroll to top'}],
  render() {
    return ui.largeTitle({eyebrow: 'Dev gallery', title: 'Kit', subtitle: 'Every shared primitive on real league data.'}) +
      checksSection() + sec('Routes', routeRows()) + avatarsSection() + typeSection() + buttonsSection() + badgesSection() + controlsSection() +
      cardsSection() + tilesSection() + bugsSection() + tapeSection() + ringSection() + motionSection() + overlaysSection() + statesSection() + iconsSection();
  },
  mount(el, ctx) {
    // The checks are CPU-heavy (every h2h pair, a second league derivation): run them once the push has settled.
    el._kitCancel = ui.whenIdle(() => renderChecks(el));
    const out = () => el.querySelector('[data-kit-result]');
    el.addEventListener('ui:change', e => {
      const n = el.querySelector('[data-kit-change]');
      if (n) n.textContent = `Last ui:change: ${e.detail.name} = ${JSON.stringify(e.detail.value)}`;
    });
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-demo]');
      if (!b) return;
      const d = b.dataset.demo;
      if (d === 'loading') { ui.setLoading(b, true); setTimeout(() => ui.setLoading(b, false), 1600); }
      else if (d === 'tiles') {
        replay++;
        const t = el.querySelector('[data-kit-tiles]').closest('.kit-sec');
        const x = data.AT.find(a => a.id === 'evan') || data.AT[0];
        t.querySelectorAll('[data-count-to]').forEach((v, i) => { v.removeAttribute('data-hyd'); v.dataset.countKey = 'kit-r' + replay + '-' + i; });
        ui.hydrate(t);
        void x;
      }
      else if (d === 'split') { const s = el.querySelector('[data-kit-split]'); ui.splitUpdate(s, .15 + Math.random() * .7); }
      else if (d === 'ring-zero' || d === 'ring-rand' || d === 'ring-perfect') {
        const r = el.querySelector('.kit-ring-main');
        const parts = d === 'ring-perfect' ? [{frac: 1, perfect: true}, {frac: 1, perfect: true}, {frac: 1, perfect: true}]
          : d === 'ring-rand' ? [0, 1, 2].map(() => ({frac: Math.round(Math.random() * 10) / 10}))
          : [{frac: .6}, {frac: 1}, {frac: .44}];
        const total = d === 'ring-perfect' ? 1000 : Math.round(parts[0].frac * 200 + parts[1].frac * 350 + parts[2].frac * 450);
        ui.ringUpdate(r, parts, {animate: true, from: d === 'ring-zero' ? 'zero' : undefined});
        ui.countUp(el.querySelector('[data-kit-ringtotal]'), total, {from: d === 'ring-zero' ? 0 : ringState, duration: 1100});
        ringState = total;
        if (d === 'ring-perfect') { ui.animate(r, [{transform: 'scale(1)'}, {transform: 'scale(1.04)'}, {transform: 'scale(1)'}], {duration: 600, easing: 'ease-in-out', delay: 700}); ui.haptic('celebrate'); ui.confetti(r.getBoundingClientRect(), {count: 120}); }
      }
      else if (d === 'count') ui.countUp(el.querySelector('[data-kit-count]'), 1000, {from: 0, duration: 1100, format: 'int'}).then(() => ui.haptic('success'));
      else if (d === 'odo-up' || d === 'odo-down') { const was = odoVal; odoVal = Math.max(0, odoVal + (d === 'odo-up' ? 1 : -1)); ui.odometer(el.querySelector('[data-kit-odo]'), was, odoVal); }
      else if (d === 'float') {
        const p = el.querySelector('.kit-pts');
        ui.floatText(b, '+40');
        const n = p.querySelector('.ell');
        const cur = parseInt(n.textContent, 10) || 0;
        ui.countUp(n, cur + 40, {from: cur, duration: 500, format: v => `${Math.round(v)} pts`});
        ui.haptic('success');
      }
      else if (d === 'shake') { ui.shake(el.querySelector('.kit-pts')); ui.haptic('error'); }
      else if (d === 'flip-y' || d === 'flip-x') {
        const f = el.querySelector('[data-kit-flip]');
        const rel = ctx.busy();
        await ui.flipCard(f, {axis: d === 'flip-x' ? 'x' : 'y', half: d === 'flip-x' ? 170 : 250, onHalf: () => { f.classList.toggle('is-on'); f.firstElementChild.textContent = f.classList.contains('is-on') ? 'Flipped' : 'Tap flip'; }});
        rel();
      }
      else if (d === 'stamp') { el.querySelectorAll('[data-kit-stamp], .kit-demo .b-deep').forEach(s => ui.stamp(s)); ui.haptic('celebrate'); }
      else if (d === 'confetti') ui.confetti(b.getBoundingClientRect(), {count: 60});
      else if (d === 'flip-list') {
        const g = el.querySelector('.kit-flipgroup');
        ui.flip(g, () => { const rows = [...g.children]; rows.sort(() => Math.random() - .5).forEach(r => g.appendChild(r)); });
      }
      else if (d === 'stagger') ui.stagger(el.querySelector('.kit-flipgroup'));
      else if (d === 'sheet-medium' || d === 'sheet-large' || d === 'sheet-fit') sheetDemo(d, out());
      else if (d === 'action') {
        const v = await ui.actionSheet({title: 'Give up 3 squares?', message: "You'll keep 300 points and see one player who fits each empty square.", actions: [{label: 'Give up', value: 'give', role: 'destructive'}, {label: 'Keep playing', value: 'keep', role: 'cancel'}]});
        out().textContent = 'Confirm sheet resolved: ' + JSON.stringify(v);
        if (v === 'give') ui.haptic('warning');
      }
      else if (d === 'sort') {
        const v = await ui.actionSheet({title: 'Sort by', actions: ['Win %', 'Record', 'Points per game', 'Playoff trips', 'Titles', 'Name'].map((l, i) => ({label: l, value: i, checked: i === 0}))});
        out().textContent = 'Sort sheet resolved: ' + JSON.stringify(v);
      }
      else if (d === 'pick') {
        const v = await ui.pickManager({title: 'Pick a manager', selected: 'evan', disabled: ['mason'], note: 'Only saved on this phone. Used to highlight you.', allowNone: true});
        out().textContent = 'pickManager resolved: ' + JSON.stringify(v);
      }
      else if (d === 'toast') ui.toast('Results copied. Paste them in the league chat.', {icon: 'check-circle'});
      else if (d === 'toast-act') ui.toast('Mason just passed you. 820 to your 790.', {action: {label: 'See board', fn: () => { out().textContent = 'Toast action tapped.'; }}, duration: 4000});
      else if (d === 'announce') { ui.announce('Correct. +50'); out().textContent = 'Announced "Correct. +50" to screen readers.'; }
      else if (d === 'haptic') { ui.haptic(b.dataset.kind); out().textContent = `haptic('${b.dataset.kind}')${ui.HAPTICS_SUPPORTED ? '' : ' (vibrate unsupported here)'}`; }
    });
    if (ctx.first) ui.stagger(el.querySelector('.kit-flipgroup'));
  },
  unmount(el) {
    if (el._kitCancel) { el._kitCancel(); el._kitCancel = null; }
  },
  onAction(id, ctx) {
    if (id === 'top') ctx.screen.scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
    if (id === 'checks') { const c = ctx.screen.querySelector('#kit-checks'); if (c) ctx.screen.scrollTo({top: c.offsetTop - 60, behavior: ui.RM ? 'auto' : 'smooth'}); }
  }
};
