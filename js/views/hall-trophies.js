// Hall › Trophies (spec 7.13): champion hero with the once-per-session champion moment (spec 8.10),
// one banner per completed season, the title count and "Still chasing". Owner: hall package.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = data.esc;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const prof = id => `#/managers/${encodeURIComponent(id)}`;
const MORPH = {'data-morph-from': ''};

// The champion moment plays once per session (sessionStorage gg-s-champ) and never under reduced motion.
const momentPending = () => !ui.RM && ui.ssGet('gg-s-champ') !== '1';

let S = null; // mounted state: {el, ctx, hc, io, inView, cancel, played}

// ------------------------------------------------------------------ Champion hero
function hero(pending) {
  const s = data.DONE[0];
  if (!s || !s.champion) return '';
  const id = s.champion;
  const team = data.teamIn(s, id);
  const fin = s.games.find(g => g.type === 'final');
  const score = fin ? ` ${data.fmt(fin.ws)} to ${data.fmt(fin.ls)}` : '';
  // (existing) copy, word for word
  const line = `${team} won the ${s.year} title${s.runnerUp ? `, beating ${data.name(s.runnerUp)}${score} in the championship` : ''}.`;
  return `<a class="card card-hero hc ${data.color(id).cls}${pending ? ' is-pending' : ''}" href="${prof(id)}" data-enter>`
    + `<span class="hc-av">`
    + `<svg class="hc-ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="57" pathLength="100"/></svg>`
    + ui.avatar(id, {size: 96, hero: true, crown: true, attrs: MORPH})
    + `</span>`
    + `<span class="ovl hc-ovl">${ui.icon('trophy-fill')}Reigning champion</span>`
    + `<span class="t-large hc-name">${esc(data.name(id))}</span>`
    + `<span class="t-headline hc-team">${esc(team)}</span>`
    + `<span class="t-sub hc-line">${esc(line)}</span>`
    + `</a>`;
}

// ------------------------------------------------------------------ Banners
function mini(id, badgeHTML, what) {
  if (!id) return '';
  return `<div class="bn-mini"><a class="bn-who" href="${prof(id)}" aria-label="${esc(what + ': ' + data.name(id))}">${ui.avatar(id, {size: 24, attrs: MORPH})}<span class="ell">${esc(data.name(id))}</span></a>${badgeHTML}</div>`;
}

function banner(s) {
  const ch = s.champion;
  const label = `${s.year} season: ${data.name(ch)} champion`;
  return `<article class="bn ${data.color(ch).cls}" data-enter>`
    + `<a class="bn-link" href="#/standings/${s.year}" aria-label="${esc(label)}"></a>`
    + `<div class="bn-year" aria-hidden="true"><span class="n3">${s.year}</span>${ui.icon('trophy-fill')}</div>`
    + `<div class="bn-main">`
    + `<div class="bn-top"><a class="bn-champ" href="${prof(ch)}">${ui.avatar(ch, {size: 40, attrs: MORPH})}<span class="bn-cm"><span class="bn-cn">${esc(data.name(ch))}</span><span class="bn-ct">${esc(data.teamIn(s, ch))}</span></span></a>${ui.badge('champ')}</div>`
    + `<div class="bn-rest">`
    + mini(s.runnerUp, ui.badge('2nd', 'Runner-up'), 'Runner-up')
    + mini(s.thirdPlace, ui.badge('3rd', 'Third'), 'Third')
    + mini(s.lastPlace, ui.badge('last', 'Worst record'), 'Worst record')
    + `</div></div></article>`;
}

// The season being played: a dashed banner that is still up for grabs.
function liveBanner() {
  const s = data.SEASONS.find(x => x.live);
  if (!s) return '';
  const wk = data.throughWeek(s);
  const top = s.table[0];
  const played = top && (top.w + top.l + top.t) > 0;
  const lead = played
    ? `<div class="bn-mini"><a class="bn-who" href="${prof(top.id)}" aria-label="${esc('Top seed: ' + data.name(top.id))}">${ui.avatar(top.id, {size: 24, attrs: MORPH})}<span class="ell">${esc(data.name(top.id))}</span></a><span class="bn-note">Top seed · ${esc(data.recStr(top.w, top.l, top.t))}</span></div>`
    : '';
  return `<article class="bn bn-live" data-enter>`
    + `<a class="bn-link" href="#/standings/${s.year}" aria-label="${esc(`${s.year} season: in progress${wk ? `, through week ${wk}` : ''}`)}"></a>`
    + `<div class="bn-year" aria-hidden="true"><span class="n3">${s.year}</span></div>`
    + `<div class="bn-main">`
    + `<div class="bn-lv">${ui.badge('progress', wk ? `IN PROGRESS · THROUGH WK ${wk}` : 'IN PROGRESS')}</div>`
    + `<p class="bn-open">Banner still up for grabs.</p>`
    + lead
    + `</div></article>`;
}

// ------------------------------------------------------------------ Title count
function titleCount() {
  const me = data.me();
  const winners = data.AT.filter(x => x.titles > 0).sort((x, y) => y.titles - x.titles || y.seconds - x.seconds || y.pct - x.pct);
  if (!winners.length) return '';
  const rows = winners.map(x => {
    const yrs = data.SEASONS.filter(s => s.champion === x.id).map(s => s.year).sort().join(', ');
    const n = x.titles;
    const icons = n <= 5 ? ui.icon('trophy-fill').repeat(n) : ui.icon('trophy-fill') + `<span class="tc-x">×${n}</span>`;
    return ui.row({
      lead: ui.avatar(x.id, {size: 32, attrs: MORPH}),
      title: data.name(x.id),
      sub: yrs,
      trail: `<span class="tc-marks" aria-hidden="true">${icons}</span><span class="n4 tc-n">${n}</span>`,
      key: x.id,
      me: x.id === me,
      cls: 'tc-row',
      attrs: {href: prof(x.id), 'aria-label': `${data.name(x.id)}, ${plural(n, 'title')}: ${yrs}`}
    });
  }).join('');
  return `<section class="tc" data-enter aria-labelledby="hl-tc">${ui.sectionHeader({title: 'Title count', id: 'hl-tc'})}${ui.group(rows)}</section>`;
}

// ------------------------------------------------------------------ Still chasing
function stillChasing() {
  const me = data.me();
  const none = data.AT.filter(x => x.titles === 0 && x.seasons > 0)
    .sort((x, y) => y.seasons - x.seasons || data.name(x.id).localeCompare(data.name(y.id)));
  if (!none.length) return '';
  const items = none.map(x => `<a class="sc-it" href="${prof(x.id)}" aria-label="${esc(`${data.name(x.id)}, ${plural(x.seasons, 'season')} without a title`)}">`
    + ui.avatar(x.id, {size: 40, you: x.id === me, attrs: MORPH})
    + `<span class="sc-n">${esc(data.name(x.id))}</span><span class="sc-s">${esc(plural(x.seasons, 'season'))}</span></a>`).join('');
  // (existing) footnote
  const note = `Still chasing a first title: ${none.map(x => data.name(x.id)).join(', ')}.`;
  return `<section class="sc" data-enter aria-labelledby="hl-sc">${ui.sectionHeader({title: 'Still chasing', id: 'hl-sc'})}`
    + `<div class="sc-rail" data-hscroll>${items}</div><p class="note">${esc(note)}</p></section>`;
}

// ------------------------------------------------------------------ Segment API
export function render() {
  const pending = momentPending();
  const done = data.DONE.filter(s => s.champion);
  let h = '';
  if (done.length) {
    h += hero(pending);
  } else {
    h += `<div class="hl-empty" data-enter>${ui.empty({icon: 'trophy', title: 'No champions yet.', body: 'The first banner goes up after the championship.'})}</div>`;
  }
  const banners = liveBanner() + done.map(banner).join('');
  if (banners) h += `<section class="bns" aria-labelledby="hl-bn">${ui.sectionHeader({title: 'Banners', id: 'hl-bn'})}<div class="bn-list">${banners}</div></section>`;
  h += titleCount();
  h += stillChasing();
  return `<div class="hl-tro">${h}</div>`;
}

function tryPlay() {
  if (!S || !S.hc || S.played || S.cancel) return;
  if (!S.inView || !S.ctx.visible || document.hidden) return;
  if (ui.RM) { settle(); return; }
  // Wait for the push/tab motion and the entrance stagger to settle, then play.
  S.cancel = ui.whenIdle(() => {
    if (!S) return;
    S.cancel = null;
    if (S.inView && S.ctx.visible && !document.hidden) play();
  });
}

// Final state without motion (reduced motion switched on after render).
function settle() {
  if (!S || !S.hc) return;
  S.played = true;
  if (S.io) { S.io.disconnect(); S.io = null; }
  S.hc.classList.remove('is-pending');
}

function play() {
  const hc = S.hc;
  S.played = true;
  if (S.io) { S.io.disconnect(); S.io = null; }
  ui.ssSet('gg-s-champ', '1');
  const circle = hc.querySelector('.hc-ring circle');
  const crown = hc.querySelector('.hc-av .av-crown');
  hc.classList.remove('is-pending');
  if (circle) {
    circle.style.strokeDashoffset = '0';
    ui.animate(circle, [{strokeDashoffset: 100}, {strokeDashoffset: 0}], {duration: 700, easing: 'cubic-bezier(.16,1,.3,1)'});
  }
  if (crown) {
    // The crown drops onto the ring as it closes (bouncy spring, about 9% overshoot).
    ui.animate(crown, [{transform: 'translateY(-34px) scale(1.4)', opacity: 0}, {transform: 'none', opacity: 1}], {spring: 'bouncy', delay: 540, fill: 'backwards'});
  }
}

export function mount(el, ctx) {
  S = {el, ctx, hc: el.querySelector('.hc.is-pending'), io: null, inView: false, cancel: null, played: false};
  if (!S.hc) return;
  const target = S.hc.querySelector('.hc-av') || S.hc;
  if (typeof IntersectionObserver !== 'function') { S.inView = true; return; }
  S.io = new IntersectionObserver(es => {
    if (!S) return;
    const e = es[es.length - 1];
    S.inView = e.isIntersecting && e.intersectionRatio >= .6;
    if (S.inView) tryPlay();
    else if (S.cancel) { S.cancel(); S.cancel = null; }
  }, {root: ctx.screen || null, threshold: [0, .6, 1]});
  S.io.observe(target);
}

export function show() { tryPlay(); }

export function unmount() {
  if (!S) return;
  if (S.io) S.io.disconnect();
  if (S.cancel) S.cancel();
  S = null;
}
