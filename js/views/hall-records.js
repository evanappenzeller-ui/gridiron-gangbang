// Hall › Records (spec 7.14): record hero with a count-up, fun-facts carousel with page dots, sticky
// section chips with scroll-spy, record rows whose holders link to profiles, and the focus param
// (/hall/records/2.4 scrolls that row to the center and flashes it). Owner: hall package.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';

const esc = data.esc;
const prof = id => `#/managers/${encodeURIComponent(id)}`;
const MORPH = {'data-morph-from': ''};
const BAD_LINK = "That link didn't lead anywhere.";

let S = null; // mounted state

// ------------------------------------------------------------------ Text helpers
const QN = s => String(s).replace(/[’‘`]/g, "'");

// End index (exclusive) in `str` of a holders() match that starts at `at`. holders() also matches
// case-insensitively and ignoring whitespace, so the matched text can differ in length from `team`.
function spanEnd(str, at, team) {
  const S0 = QN(str), L = S0.toLowerCase();
  const T = QN(team).toLowerCase().replace(/\s+/g, '');
  if (L.length !== S0.length) return Math.min(str.length, at + String(team).length);
  let i = at, j = 0;
  while (i < L.length && j < T.length) {
    if (/\s/.test(L[i]) && !/\s/.test(T[j])) { i++; continue; }
    if (L[i] !== T[j]) break;
    i++; j++;
  }
  return j === T.length ? i : Math.min(str.length, at + String(team).length);
}

// Split a string into plain and matched pieces (matches in position order, overlaps skipped).
function pieces(str, matches) {
  const s = String(str == null ? '' : str);
  const out = [];
  let pos = 0;
  (matches || []).slice().sort((a, b) => a.at - b.at).forEach(m => {
    if (m.at < pos || m.at >= s.length) return;
    const end = spanEnd(s, m.at, m.team);
    if (end <= m.at) return;
    if (m.at > pos) out.push({t: s.slice(pos, m.at)});
    out.push({t: s.slice(m.at, end), m});
    pos = end;
  });
  if (pos < s.length) out.push({t: s.slice(pos)});
  return out;
}

// Escaped text whose trailing emoji-only token ("Squad 💣") never wraps onto a line of its own.
const glue = s => esc(s).replace(/\s+(?=[^\s\p{L}\p{N}]+$)/u, '&nbsp;');

// Inline link: a 20 px avatar glued to the first word, the name emphasized.
function inlineLink(id, text) {
  const t = String(text);
  const k = t.search(/\s/);
  const head = k < 0 ? t : t.slice(0, k), tail = k < 0 ? '' : t.slice(k);
  return `<a class="rl" href="${prof(id)}"><span class="rl-h">${ui.avatar(id, {size: 20, attrs: MORPH})}${esc(head)}</span>${glue(tail)}</a>`;
}

// Every matched team name becomes a profile link with an inline avatar (hero line, fun facts).
function linkify(str) {
  return pieces(str, data.holders(str)).map(p => p.m ? inlineLink(p.m.id, p.t) : esc(p.t)).join('');
}

// Values as the record book writes them ("210.54", "2,238", "−6", "13"); decimals render small.
function valHTML(v) {
  const s = String(v == null ? '' : v);
  const m = /^([−-]?[\d,]*\d)(\.\d+)$/.exec(s.trim());
  return m ? `${esc(m[1])}<small>${esc(m[2])}</small>` : esc(s);
}
function numOf(v) {
  const s = String(v == null ? '' : v).trim().replace(/,/g, '').replace(/^−/, '-');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

// ------------------------------------------------------------------ Model
function model() {
  const R = data.DATA && data.DATA.records;
  const flat = data.recordsFlat();
  const secs = [];
  const byTitle = new Map();
  flat.forEach(r => {
    let sec = byTitle.get(r.section);
    if (!sec) { sec = {title: r.section, items: []}; byTitle.set(r.section, sec); secs.push(sec); }
    sec.items.push(r);
  });
  const fallback = flat.length > 0 && flat.every(r => r.key.startsWith('f.'));
  return {R: R || null, secs, fallback, keys: new Set(flat.map(r => r.key))};
}

// ------------------------------------------------------------------ Pieces
function heroCard(R) {
  const h = R && R.hero;
  if (!h || (h.val == null && !h.over && !h.line)) return '';
  const n = numOf(h.val);
  const count = isFinite(n) && n > 0;
  const lead = data.holders(h.line || '')[0];
  return `<div class="card card-hero rh${lead ? ' ' + data.color(lead.id).cls : ''}" data-enter>`
    + (h.over ? `<p class="ovl rh-ovl">${esc(h.over)}</p>` : '')
    + `<p class="n1 rh-val"${count ? ` data-rh-count="${n}"` : ''}>${valHTML(h.val)}</p>`
    + (h.line ? `<p class="t-sub rh-line">${linkify(h.line)}</p>` : '')
    + `</div>`;
}

function funFacts(R) {
  const hl = ((R && R.highlights) || []).map(x => String(x == null ? '' : x)).filter(x => x.trim());
  if (!hl.length) return '';
  const m = hl.length;
  const cards = hl.map((t, i) => {
    const lead = data.holders(t)[0];
    return `<div class="ff-card${lead ? ' ' + data.color(lead.id).cls : ''}" role="group" aria-roledescription="slide" aria-label="Fact ${i + 1} of ${m}" data-i="${i}">`
      + `<span class="ovl ff-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`
      + `<p class="t-callout ff-t">${linkify(t)}</p></div>`;
  }).join('');
  const dots = m > 1
    ? `<div class="ff-dots">${hl.map((_, i) => `<button type="button" class="ff-dot${i === 0 ? ' is-on' : ''}" data-dot="${i}" aria-label="Fact ${i + 1} of ${m}"${i === 0 ? ' aria-current="true"' : ''}><i></i></button>`).join('')}</div>`
    : '';
  return `<section class="ff" data-enter aria-labelledby="hl-ff">${ui.sectionHeader({title: 'Fun facts', id: 'hl-ff'})}`
    + `<div class="ff-rail" data-hscroll role="region" aria-roledescription="carousel" aria-label="Fun facts" tabindex="-1">${cards}</div>${dots}</section>`;
}

function holderLine(line, matches) {
  const prim = matches && matches[0];
  if (!prim) return `<p class="rc-h">${esc(line)}</p>`;
  const txt = pieces(line, [prim]).map(p => p.m ? `<b>${glue(p.t)}</b>` : esc(p.t)).join('');
  return `<a class="rc-h is-link" href="${prof(prim.id)}" aria-label="${esc(`${data.name(prim.id)}: ${line}`)}">${ui.avatar(prim.id, {size: 20, attrs: MORPH})}<span class="rc-ht">${txt}</span></a>`;
}

function recordRow(r) {
  const lines = (r.holders || []).map((h, k) => holderLine(h, r.matches && r.matches[k])).join('');
  const v = String(r.val == null ? '' : r.val);
  const long = v.replace(/[.,]/g, '').length > 6;
  return `<div class="rc" data-key="${esc(r.key)}">`
    + `<div class="rc-main"><h3 class="rc-l">${esc(r.label)}</h3>${lines ? `<div class="rc-hs">${lines}</div>` : ''}</div>`
    + `<div class="rc-v"><span class="n4${long ? ' is-long' : ''}">${valHTML(v)}</span>${r.unit ? `<span class="t-cap">${esc(r.unit)}</span>` : ''}</div>`
    + `</div>`;
}

function sections(secs) {
  return secs.map((s, i) => `<section class="rc-sec" data-sec="${i}" aria-labelledby="hl-rs-${i}">`
    + ui.sectionHeader({title: s.title, id: 'hl-rs-' + i})
    + ui.group(s.items.map(recordRow).join(''), {cls: 'rc-g'})
    + `</section>`).join('');
}

// ------------------------------------------------------------------ Segment API
export function render() {
  const {R, secs} = model();
  let h = heroCard(R) + funFacts(R);
  if (!secs.length) {
    h += `<div class="hl-empty" data-enter>${ui.empty({icon: 'medal', title: 'No records yet.', body: 'The record book fills in once games are played.'})}</div>`;
    return `<div class="hl-rec">${h}</div>`;
  }
  if (secs.length > 1) {
    h += `<div class="accessory rc-acc">${ui.chips({name: 'hall-sec', items: secs.map((s, i) => ({id: String(i), label: s.title})), value: '0', label: 'Record sections'})}</div>`;
  }
  h += `<div class="rc-list">${sections(secs)}</div>`;
  if (R && R.source) h += `<p class="note rc-src">${esc(R.source)}</p>`;
  h += `<span class="rc-end" aria-hidden="true"></span>`;
  return `<div class="hl-rec">${h}</div>`;
}

// Geometry of the sticky chrome inside the screen.
function chrome() {
  const scr = S.ctx.screen;
  const nav = scr && scr.querySelector(':scope > .nav');
  const acc = S.acc;
  const tab = document.getElementById('tabbar');
  return {
    scr,
    navH: nav ? nav.offsetHeight : 44,
    accH: acc ? acc.offsetHeight || 44 : 0,
    tabH: tab ? tab.offsetHeight : 56
  };
}
const topIn = (scr, node) => node.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop;

// ---------------- Scroll-spy (IntersectionObserver on a 1 px band just under the sticky chips)
function spySetup() {
  if (!S.chips || !S.secs.length || typeof IntersectionObserver !== 'function') return;
  const {scr, navH, accH, tabH} = chrome();
  if (!scr) return;
  if (S.spy) S.spy.disconnect();
  if (S.endIO) S.endIO.disconnect();
  S.inBand = new Set();
  const top = navH + accH;
  const H = scr.clientHeight;
  S.spyH = H;
  S.bandTop = top;
  if (!H) return; // hidden layer: set up again when shown
  S.spy = new IntersectionObserver(es => {
    if (!S) return;
    es.forEach(e => { const i = +e.target.dataset.sec; if (e.isIntersecting) S.inBand.add(i); else S.inBand.delete(i); });
    spyPick();
  }, {root: scr, rootMargin: `-${top}px 0px -${Math.max(0, H - top - 1)}px 0px`, threshold: 0});
  S.secs.forEach(s => S.spy.observe(s));
  if (S.end) {
    S.endIO = new IntersectionObserver(es => {
      if (!S) return;
      S.atEnd = es[es.length - 1].isIntersecting;
      spyPick();
    }, {root: scr, rootMargin: `0px 0px -${tabH}px 0px`, threshold: 0});
    S.endIO.observe(S.end);
  }
}
function spyPick() {
  if (S.hold || performance.now() < S.lockUntil) return;
  let i = S.active;
  if (S.atEnd) i = S.secs.length - 1;
  else if (S.inBand.size) i = Math.min(...S.inBand);
  else if (S.secs[0] && S.ctx.screen) {
    // Nothing under the band: above the first section (hero, fun facts) the first chip is current.
    const top = S.ctx.screen.getBoundingClientRect().top + (S.bandTop || 0);
    if (S.secs[0].getBoundingClientRect().top >= top) i = 0;
  }
  setActive(i);
}
function setActive(i) {
  if (i === S.active) return;
  S.active = i;
  ui.setChips(S.chips, String(i), {scroll: true});
}

function scrollToSection(i) {
  const sec = S.secs[i];
  if (!sec) return;
  const {scr, navH, accH} = chrome();
  const h = sec.querySelector('.sh') || sec;
  const target = Math.max(0, Math.round(topIn(scr, h) - navH - accH - 8));
  S.lockUntil = performance.now() + (ui.RM ? 120 : 900);
  scr.scrollTo({top: target, behavior: ui.RM ? 'auto' : 'smooth'});
}

// ---------------- Fun-facts carousel
function factsSetup() {
  const rail = S.el.querySelector('.ff-rail');
  if (!rail) return;
  S.rail = rail;
  S.dots = [...S.el.querySelectorAll('.ff-dot')];
  if (!S.dots.length || typeof IntersectionObserver !== 'function') return;
  const ratios = new Map();
  S.factIO = new IntersectionObserver(es => {
    if (!S) return;
    es.forEach(e => ratios.set(+e.target.dataset.i, e.intersectionRatio));
    let best = -1, bi = S.fact || 0;
    ratios.forEach((r, i) => { if (r > best + .001) { best = r; bi = i; } });
    if (best >= .5) setDot(bi);
  }, {root: rail, threshold: [0, .25, .5, .75, 1]});
  rail.querySelectorAll('.ff-card').forEach(c => S.factIO.observe(c));
}
function setDot(i) {
  if (!S.dots || i === S.fact) return;
  S.fact = i;
  S.dots.forEach((d, k) => {
    d.classList.toggle('is-on', k === i);
    if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
  });
}
function scrollToFact(i) {
  const card = S.rail && S.rail.querySelector(`.ff-card[data-i="${i}"]`);
  if (!card) return;
  const pad = parseFloat(getComputedStyle(S.rail).scrollPaddingLeft) || 16;
  S.rail.scrollTo({left: Math.max(0, card.offsetLeft - pad), behavior: ui.RM ? 'auto' : 'smooth'});
  setDot(i);
}

// ---------------- Focus param
function wantFocus(ctx) {
  // A data reload or a "me" change rebuilds the list quietly: never jump or flash again.
  if (ctx.reason === 'data' || ctx.reason === 'me') { S.focus = null; return; }
  const f = ctx.params && ctx.params.focus;
  S.focus = f ? String(f) : null;
  S.focusDone = false;
  if (S.focus && !S.keys.has(S.focus)) {
    S.focus = null;
    ui.toast(BAD_LINK);
  }
  if (S.focus && ctx.visible) runFocus();
}
function runFocus() {
  if (!S || !S.focus || S.focusDone) return;
  const row = S.el.querySelector(`.rc[data-key="${CSS.escape(S.focus)}"]`);
  const {scr, navH, tabH} = chrome();
  if (!row || !scr || !row.offsetHeight || !scr.clientHeight) return; // not laid out yet: retried on show
  S.focusDone = true;
  // The chips will be pinned once we are down among the records, so count them in.
  const accH = S.acc ? (S.acc.offsetHeight || 44) : 0;
  const bandTop = navH + accH, bandBot = scr.clientHeight - tabH;
  const target = topIn(scr, row) + row.offsetHeight / 2 - (bandTop + bandBot) / 2;
  S.lockUntil = 0;
  scr.scrollTop = Math.max(0, Math.round(target));
  // The chip shows the focused record's section until the reader touches the screen.
  const i = +((row.closest('.rc-sec') || {}).dataset || {}).sec;
  if (S.chips && isFinite(i)) { S.active = -1; setActive(i); S.hold = true; }
  row.classList.remove('is-focus');
  void row.offsetWidth; // restart the flash
  row.classList.add('is-focus');
  clearTimeout(S.flashT);
  S.flashT = setTimeout(() => row.classList.remove('is-focus'), 1400);
}

export function mount(el, ctx) {
  const m = model();
  S = {
    el, ctx, keys: m.keys,
    acc: el.querySelector('.rc-acc'),
    chips: el.querySelector('.rc-acc [data-chips]'),
    secs: [...el.querySelectorAll('.rc-sec')],
    end: el.querySelector('.rc-end'),
    active: 0, lockUntil: 0, hold: false, inBand: new Set(), atEnd: false, bandTop: 0,
    spy: null, endIO: null, factIO: null, rail: null, dots: null, fact: 0,
    focus: null, focusDone: false, flashT: 0, ac: new AbortController()
  };
  const sig = {signal: S.ac.signal};

  // Record hero count-up (only when the value is a number above zero).
  const hv = el.querySelector('.rh-val[data-rh-count]');
  if (hv) {
    const raw = String((m.R && m.R.hero && m.R.hero.val) || '');
    const to = +hv.dataset.rhCount;
    const dec = (raw.split('.')[1] || '').length;
    const commas = /,/.test(raw);
    const final = valHTML(raw);
    const fmt = (v, done) => {
      if (done) return final;
      const i = Math.floor(Math.max(0, v));
      const s = commas ? data.nf(i) : String(i);
      return dec ? `${s}<small style="visibility:hidden">.${'0'.repeat(dec)}</small>` : s;
    };
    ui.countUp(hv, to, {format: fmt, duration: 1100, key: 'hall-rec-hero|' + raw});
  }

  // Chips: a tap scrolls to that section (also when it is already the selected chip).
  if (S.chips) {
    S.chips.addEventListener('click', e => {
      const c = e.target.closest('.chip');
      if (!c) return;
      const i = +c.dataset.value;
      if (i !== S.active) ui.haptic('selection');
      S.active = i;
      ui.setChips(S.chips, String(i), {scroll: true});
      scrollToSection(i);
    }, sig);
    const scr = ctx.screen;
    if (scr) {
      scr.addEventListener('scrollend', () => { if (S) S.lockUntil = 0; }, {signal: S.ac.signal, passive: true});
      const release = () => { if (S) S.hold = false; };
      ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(t => scr.addEventListener(t, release, {signal: S.ac.signal, passive: true}));
    }
    addEventListener('resize', () => { if (S && S.ctx.visible) spySetup(); }, {signal: S.ac.signal, passive: true});
  }

  // Carousel dots
  el.addEventListener('click', e => {
    const d = e.target.closest('.ff-dot');
    if (d && el.contains(d)) scrollToFact(+d.dataset.dot);
  }, sig);

  factsSetup();
  spySetup();
  wantFocus(ctx);
}

// A different record in focus while Records is already showing.
export function params(ctx) {
  if (!S) return;
  wantFocus(ctx);
}

export function show() {
  if (!S) return;
  if (S.chips && (!S.spy || S.spyH !== (S.ctx.screen && S.ctx.screen.clientHeight))) spySetup();
  runFocus();
}

export function unmount() {
  if (!S) return;
  S.ac.abort();
  if (S.spy) S.spy.disconnect();
  if (S.endIO) S.endIO.disconnect();
  if (S.factIO) S.factIO.disconnect();
  clearTimeout(S.flashT);
  S = null;
}
