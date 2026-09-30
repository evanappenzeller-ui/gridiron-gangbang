// DOM primitives: markup helpers, springs and motion, sheets, toasts, haptics, count-ups, FLIP, confetti.
// Owner: foundation (shell). Views import from here and never build these components by hand.
//
// Markup rule: helpers return HTML strings. TEXT params (title, sub, label, eyebrow, subtitle, body text,
// placeholder, value, msg) are escaped; wrap trusted HTML in ui.raw(html) to pass it through.
// SLOT params (lead, trail, trailing, center, header, inner, body of sheets) are HTML and inserted as-is.
import {esc, color, nf, name, team, seasonByYear, hueClose, ids} from './data.js';

// ============================================================================ Environment
const DOC = document.documentElement;
const mqRM = matchMedia('(prefers-reduced-motion: reduce)');
/** Reduced motion, live binding (updates when the OS setting changes). */
export let RM = mqRM.matches;
const rmChange = e => { RM = e.matches; DOC.classList.toggle('rm', RM); };
if (mqRM.addEventListener) mqRM.addEventListener('change', rmChange); else if (mqRM.addListener) mqRM.addListener(rmChange);

const supports = (p, v) => { try { return CSS.supports(p, v); } catch (_) { return false; } };
const BLUR_OK = supports('backdrop-filter', 'blur(1px)') || supports('-webkit-backdrop-filter', 'blur(1px)');
/** Lite mode: low-memory device or no backdrop blur. */
export const LITE = !!((navigator.deviceMemory && navigator.deviceMemory <= 4) || !BLUR_OK);
/** Installed iOS home-screen app. */
export const IOS_STANDALONE = navigator.standalone === true;
/** Any installed display mode. */
export const STANDALONE = IOS_STANDALONE || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
/** CSS linear() easing support (springs); otherwise the cubic fallbacks are used. */
export const LINEAR_OK = supports('transition-timing-function', 'linear(0, 1)');

// Storage (every access wrapped; the app works when storage throws)
export function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
export function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); return true; } catch (_) { return false; } }
export function ssGet(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
export function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, String(v)); return true; } catch (_) { return false; } }

// ============================================================================ Formatting
/** Score with small decimals: 132<small>.46</small> (thousands separators on the integer part). */
export function score(n, dp = 2) {
  const v = Number(n);
  if (!isFinite(v)) return esc(n);
  const s = Math.abs(v).toFixed(dp);
  const [i, d] = s.split('.');
  return `${v < 0 ? '−' : ''}${nf(Number(i))}${d ? `<small>.${d}</small>` : ''}`;
}
/** 1st, 2nd, 3rd, 4th, 11th, 22nd... */
export function ordinal(n) {
  const v = Math.abs(Math.round(Number(n))), m100 = v % 100, m10 = v % 10;
  const s = (m100 >= 11 && m100 <= 13) ? 'th' : m10 === 1 ? 'st' : m10 === 2 ? 'nd' : m10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
}
/** Milliseconds to "6h 12m" (or "12m"; never below "1m"). */
export function untilText(ms) {
  const mins = Math.max(1, Math.ceil(Math.max(0, ms) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// ============================================================================ Markup basics
/** Mark trusted HTML so text params pass it through unescaped. */
export const raw = html => ({__html: html == null ? '' : String(html)});
const T = v => (v && typeof v === 'object' && '__html' in v) ? v.__html : esc(v);
const stripTags = s => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
/** attrs: string (inserted raw) or object ({k: v}; true = bare attribute, false/null = omitted). */
export function attrs(a) {
  if (!a) return '';
  if (typeof a === 'string') return ' ' + a.trim();
  let out = '';
  for (const [k, v] of Object.entries(a)) {
    if (v === false || v == null) continue;
    out += v === true ? ` ${k}` : ` ${k}="${esc(v)}"`;
  }
  return out;
}

export const ICON_NAMES = [
  'list-number', 'versus', 'trophy', 'swap',
  'chevron-left', 'chevron-right', 'chevron-down', 'close', 'search', 'clear', 'share', 'copy', 'check', 'check-circle',
  'x', 'x-circle', 'sort', 'table', 'list', 'gear', 'person', 'info', 'plus', 'lock', 'clock', 'calendar', 'arrow-up', 'arrow-down',
  'crown', 'medal', 'flame', 'sparkle', 'bolt', 'pulse', 'anchor', 'football', 'mic', 'mic-fill', 'play-fill',
  'grad-cap', 'mystery', 'grid-3', 'bulb', 'shield', 'figure', 'number', 'star', 'chart', 'letters'
];

/** <svg class="ic"> using the sprite symbol #i-<name>. */
export function icon(nm, {size, cls = '', label} = {}) {
  const st = size ? ` style="width:${size}px;height:${size}px"` : '';
  const a11y = label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"';
  return `<svg class="ic${cls ? ' ' + cls : ''}"${st}${a11y} focusable="false"><use href="#i-${esc(nm)}"/></svg>`;
}

// ============================================================================ Identity
const AV_SIZES = [20, 24, 28, 32, 36, 40, 56, 72, 96];
const avSize = s => AV_SIZES.includes(+s) ? `av-${+s}` : '';
const crownSvg = () => `<svg class="av-crown" aria-hidden="true" focusable="false"><use href="#i-crown"/></svg>`;
const avA11y = (label, fallback) => label === true ? ` role="img" aria-label="${esc(fallback)}"`
  : (typeof label === 'string' && label) ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"';

/** Manager avatar. label: undefined/false = decorative (aria-hidden), true = manager name, string = custom. */
export function avatar(id, {size = 40, hero, you, champ, crown, label, cls = '', attrs: at} = {}) {
  const c = color(id);
  const sz = avSize(size);
  const k = `av ${sz} ${c.cls}${hero ? ' av-hero' : ''}${you ? ' av-you' : ''}${champ && !you ? ' av-champ' : ''}${cls ? ' ' + cls : ''}`;
  const st = sz ? '' : ` style="--sz:${+size || 40}px"`;
  return `<span class="${k}"${st}${avA11y(label, name(id))}${attrs(at)}><span class="av-mono">${esc(c.mono)}</span>${crown ? crownSvg() : ''}</span>`;
}

function initials(nick) {
  const w = String(nick || '').trim().split(/\s+/).filter(Boolean).map(x => x.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  if (!w.length) return '?';
  return (w.length === 1 ? w[0].slice(0, 1) : w[0].slice(0, 1) + w[1].slice(0, 1)).toUpperCase();
}
/** Leaderboard nick: the mapped manager's avatar, or a neutral initials disc. */
export function nickAvatar(nick, {size = 36, managerId, you, crown, label, cls = ''} = {}) {
  if (managerId) return avatar(managerId, {size, you, crown, label, cls});
  const sz = avSize(size);
  const st = sz ? '' : ` style="--sz:${+size || 36}px"`;
  return `<span class="av ${sz} av-neutral${you ? ' av-you' : ''}${cls ? ' ' + cls : ''}"${st}${avA11y(label, nick)}><span class="av-mono">${esc(initials(nick))}</span>${crown ? crownSvg() : ''}</span>`;
}

/** Overlapping avatars. list items: manager id strings, or {id|managerId, nick, you}. */
export function avatarStack(list = [], {max = 5, size = 28, label} = {}) {
  const items = list.slice(0, max).map(x => typeof x === 'string'
    ? avatar(x, {size})
    : (x.id && !x.nick ? avatar(x.id, {size, you: x.you}) : nickAvatar(x.nick, {size, managerId: x.managerId || null, you: x.you})));
  const more = list.length - max;
  const a11y = label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"';
  return `<span class="stack"${a11y}>${items.join('')}${more > 0 ? `<span class="stack-more" style="--sz:${size}px">+${more}</span>` : ''}</span>`;
}

// ============================================================================ Headings, groups, rows
/** Large title block with the [data-collapse] sentinel app.js watches. */
export function largeTitle({eyebrow, title = '', subtitle, trailing} = {}) {
  return `<div class="lt"><div class="lt-row"><div class="lt-text">${eyebrow ? `<p class="lt-eyebrow">${T(eyebrow)}</p>` : ''}<h1 class="lt-title">${T(title)}</h1></div>${trailing ? `<div class="lt-trail">${trailing}</div>` : ''}</div><span class="lt-sentinel" data-collapse aria-hidden="true"></span>${subtitle ? `<p class="lt-sub">${T(subtitle)}</p>` : ''}</div>`;
}

/** Section header (.t-2) with an optional plain trailing action. action: {label, attrs, href}. */
export function sectionHeader({title = '', action, level = 2, id} = {}) {
  const h = level === 3 ? 'h3' : 'h2';
  let act = '';
  if (action) {
    act = action.href
      ? `<a class="btn btn-plain" href="${esc(action.href)}"${attrs(action.attrs)}><span class="btn-label">${T(action.label)}</span></a>`
      : `<button type="button" class="btn btn-plain"${attrs(action.attrs)}><span class="btn-label">${T(action.label)}</span></button>`;
  }
  return `<div class="sh"${id ? ` id="${esc(id)}"` : ''}><${h}>${T(title)}</${h}>${act}</div>`;
}

/** Inset group. inner = HTML (usually ui.row() strings). header/footer are text. */
export function group(inner, {header, footer, cls = '', attrs: at} = {}) {
  const g = `<div class="group${cls ? ' ' + cls : ''}"${attrs(at)}>${inner || ''}</div>`;
  if (!header && !footer) return g;
  return `<div class="group-wrap">${header ? `<h3 class="group-h">${T(header)}</h3>` : ''}${g}${footer ? `<p class="group-f">${T(footer)}</p>` : ''}</div>`;
}

/**
 * List row. lead/trail are HTML slots; title/sub are text (ui.raw for HTML).
 * tag defaults to <a> when attrs has href, <button> when chevron or data-* attrs are given, else <div>.
 */
export function row({lead, title = '', sub, trail, chevron, attrs: at, key, cls = '', tag, selected, me, disabled} = {}) {
  const A = attrs(at);
  const tg = tag || (/\shref=/.test(A) ? 'a' : (chevron || /\sdata-/.test(A)) ? 'button' : 'div');
  // Height classes are set here (not with :has() in CSS), so long lists pay no per-row selector cost.
  const hasSub = sub != null && sub !== '';
  const tall = lead && /av-40/.test(lead) ? ' row-72' : hasSub ? ' row-2l' : '';
  const k = `row${tall}${selected ? ' is-selected' : ''}${me ? ' is-me' : ''}${disabled ? ' is-disabled' : ''}${cls ? ' ' + cls : ''}`;
  const ty = tg === 'button' ? ' type="button"' : '';
  const dis = disabled ? (tg === 'button' ? ' disabled' : ' aria-disabled="true"') : '';
  const cur = selected && tg !== 'div' ? ' aria-current="true"' : '';
  return `<${tg} class="${k}"${ty}${key != null ? ` data-key="${esc(key)}"` : ''}${dis}${cur}${A}>${lead ? `<span class="row-lead">${lead}</span>` : ''}<span class="row-main"><span class="row-title">${T(title)}</span>${hasSub ? `<span class="row-sub">${T(sub)}</span>` : ''}</span>${trail != null && trail !== '' ? `<span class="row-trail">${trail}</span>` : ''}${chevron ? `<svg class="ic chev" aria-hidden="true" focusable="false"><use href="#i-chevron-right"/></svg>` : ''}</${tg}>`;
}

// ============================================================================ Numbers
const FMTS = {
  int: v => nf(Math.round(v)),
  score: (v, done, to) => done ? score(to) : scoreCounting(v, to),
  dec1: v => Number(v).toFixed(1),
  dec2: v => Number(v).toFixed(2),
  pct: v => Number(v).toFixed(3).replace(/^0/, ''),
  percent: v => `${Math.round(v)}%`
};
const fmtReg = new Map();
let fmtSeq = 0;
function fmtKey(f, to) {
  if (typeof f === 'function') { const k = 'f' + (++fmtSeq); fmtReg.set(k, f); return k; }
  if (typeof f === 'string' && (FMTS[f] || fmtReg.has(f))) return f;
  return Number.isInteger(Number(to)) ? 'int' : 'score';
}
function fmtFn(k, to) {
  const f = FMTS[k] || fmtReg.get(k) || FMTS[fmtKey(null, to)];
  return (v, done) => String(f(done ? to : v, done, to));
}
function scoreCounting(v, to) {
  const d = Math.abs(Number(to)).toFixed(2).split('.')[1];
  return `${nf(Math.floor(Math.max(0, v)))}<small style="visibility:hidden">.${d}</small>`;
}

/**
 * Stat tile. countTo (number) makes the value count up once per key per session (wired by ui.hydrate()).
 * format: 'int' | 'score' | 'dec1' | 'dec2' | 'pct' | 'percent' | fn(value, done) → HTML.
 */
export function statTile({label = '', value, sub, countTo, format, key, cls = '', attrs: at} = {}) {
  let v = value != null ? T(value) : '';
  let data = '';
  if (typeof countTo === 'number' && isFinite(countTo)) {
    const fk = fmtKey(format, countTo);
    const final = fmtFn(fk, countTo)(countTo, true);
    if (value == null) v = final;
    data = ` data-count-to="${countTo}" data-count-fmt="${fk}"${key ? ` data-count-key="${esc(key)}"` : ''}`;
  }
  return `<div class="tile${cls ? ' ' + cls : ''}"${attrs(at)}><span class="tile-label">${T(label)}</span><span class="tile-value n3"${data}>${v}</span>${sub != null && sub !== '' ? `<span class="tile-sub">${T(sub)}</span>` : ''}</div>`;
}

// ============================================================================ Badges, pills, buttons
const BADGES = {
  champ: ['b-champ', 'CHAMP'], champion: ['b-champ', 'CHAMP'],
  '2nd': ['b-2nd', '2ND'], runnerUp: ['b-2nd', '2ND'],
  '3rd': ['b-3rd', '3RD'], third: ['b-3rd', '3RD'],
  playoffs: ['b-playoffs', 'PLAYOFFS'],
  missed: ['b-missed', 'MISSED'],
  last: ['b-last', 'LAST', 'anchor'],
  bye: ['b-bye', 'BYE'],
  round: ['b-round', ''], qf: ['b-round', 'QF'], sf: ['b-round', 'SF'], consol: ['b-round', 'CONSOL'],
  final: ['b-final', 'FINAL'],
  progress: ['b-progress', 'IN PROGRESS'],
  blowout: ['b-blowout', 'BLOWOUT', 'bolt'],
  nail: ['b-nail', 'NAIL-BITER', 'pulse'],
  high: ['b-high', 'WEEK HIGH', 'flame'],
  you: ['b-you', 'YOU'],
  deep: ['b-deep', 'DEEP CUT']
};
export const BADGE_KINDS = Object.keys(BADGES);
/** Badge. kind: champ|2nd|3rd|playoffs|missed|last|bye|round|qf|sf|consol|final|progress|blowout|nail|high|you|deep
 *  (finishOf() values champion|runnerUp|third also work). text overrides the default label. */
export function badge(kind, text) {
  const b = BADGES[kind] || ['b-round', String(kind || '')];
  const label = text != null ? text : b[1];
  return `<span class="badge ${b[0]}">${b[2] ? icon(b[2]) : ''}${T(label)}</span>`;
}

/** Capsule. tone: 'neutral' (default) | 'tint' | 'gold' | 'wrong' | 'solid'. */
export function pill(text, {tone, icon: ic, lead = '', cls = '', attrs: at, large} = {}) {
  return `<span class="pill${tone && tone !== 'neutral' ? ' pill-' + tone : ''}${large ? ' pill-l' : ''}${cls ? ' ' + cls : ''}"${attrs(at)}>${lead}${ic ? icon(ic) : ''}<span class="ell">${T(text)}</span></span>`;
}

/** Button. kind: primary|secondary|plain|destructive|destructive-fill; size: 'l' (50, block) | 's' (34 pill). */
export function button({label = '', kind = 'primary', size = 'l', block, icon: ic, attrs: at, href, loading, disabled, cls = '', type = 'button'} = {}) {
  const k = `btn btn-${kind}${size === 's' ? ' btn-s' : ''}${block ? ' btn-block' : ''}${loading ? ' is-loading' : ''}${cls ? ' ' + cls : ''}`;
  const inner = `${ic ? icon(ic) : ''}<span class="btn-label">${T(label)}</span>${loading ? '<span class="spin" aria-hidden="true"></span>' : ''}`;
  const busy = loading ? ' aria-busy="true"' : '';
  if (href) return `<a class="${k}" href="${esc(href)}"${busy}${disabled ? ' aria-disabled="true"' : ''}${attrs(at)}>${inner}</a>`;
  return `<button type="${type}" class="${k}"${busy}${disabled ? ' disabled' : ''}${attrs(at)}>${inner}</button>`;
}
/** Toggle a button's loading state (20px spinner replaces the label). */
export function setLoading(btn, on = true) {
  if (!btn) return;
  btn.classList.toggle('is-loading', !!on);
  if (on) { btn.setAttribute('aria-busy', 'true'); if (!btn.querySelector(':scope > .spin')) btn.insertAdjacentHTML('beforeend', '<span class="spin" aria-hidden="true"></span>'); }
  else { btn.removeAttribute('aria-busy'); btn.querySelector(':scope > .spin')?.remove(); }
}

/** 44x44 icon button (22px icon). filled: iOS-style grey disc (sheet close). */
export function iconButton({icon: ic, label = '', attrs: at, cls = '', filled, disabled} = {}) {
  return `<button type="button" class="icon-btn${filled ? ' is-filled' : ''}${cls ? ' ' + cls : ''}" aria-label="${esc(label)}"${disabled ? ' disabled' : ''}${attrs(at)}>${icon(ic)}</button>`;
}

// ============================================================================ Controls
/** Segmented control. Emits a bubbling 'ui:change' {name, value} on the .seg element. */
export function seg({name: nm, items = [], value, small, label, cls = ''} = {}) {
  let i = items.findIndex(x => String(x.id) === String(value));
  if (i < 0) i = 0;
  return `<div class="seg${small ? ' seg-s' : ''}${cls ? ' ' + cls : ''}" role="tablist" data-seg="${esc(nm)}" aria-label="${esc(label || nm || '')}" style="--n:${items.length || 1};--i:${i}"><span class="seg-thumb" aria-hidden="true"></span>${items.map((x, k) => `<button type="button" role="tab" data-value="${esc(x.id)}" aria-selected="${k === i}" tabindex="${k === i ? 0 : -1}">${T(x.label)}</button>`).join('')}</div>`;
}
/** Chips rail (single select). items: [{id, label, dot, lead}]. Emits 'ui:change' {name, value}. */
export function chips({name: nm, items = [], value, label, cls = ''} = {}) {
  return `<div class="chips${cls ? ' ' + cls : ''}" role="group" data-chips="${esc(nm)}" data-hscroll aria-label="${esc(label || nm || '')}">${items.map(x => `<button type="button" class="chip" data-value="${esc(x.id)}" aria-pressed="${String(x.id) === String(value)}">${x.dot ? '<span class="chip-dot" aria-hidden="true"></span>' : ''}${x.lead || ''}${T(x.label)}</button>`).join('')}</div>`;
}
/** iOS switch. Emits 'ui:change' {name, value: boolean}. */
export function switchCtl({name: nm, checked, label = '', disabled} = {}) {
  return `<button type="button" class="switch" role="switch" data-switch="${esc(nm)}" aria-checked="${!!checked}" aria-label="${esc(label)}"${disabled ? ' disabled' : ''}></button>`;
}
/** Search field (magnifier, input, clear). Listen for 'input' on the input. */
export function searchField({name: nm = 'q', placeholder = 'Search', value = '', label, attrs: at} = {}) {
  return `<div class="search${value ? ' is-filled' : ''}">${icon('search')}<input type="search" name="${esc(nm)}" value="${esc(value)}" placeholder="${esc(placeholder)}" aria-label="${esc(label || placeholder)}" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"${attrs(at)}><button type="button" class="search-clear" aria-label="Clear search" tabindex="-1">${icon('clear')}</button></div>`;
}

// ============================================================================ Data displays
const RSHORT = {quarter: 'QF', semi: 'SF', final: 'FINAL', third: '3RD', consol: 'CONSOL'};
function teamFn(teams, yr) {
  if (teams === true) { const s = seasonByYear(yr); return id => (s && s.teams && s.teams[id]) || team(id); }
  if (typeof teams === 'function') return teams;
  if (teams && typeof teams === 'object') return id => teams[id] || '';
  return null;
}
function badgeList(badges) {
  if (!badges) return '';
  if (typeof badges === 'string') return badges;
  return badges.map(b => Array.isArray(b) ? badge(b[0], b[1]) : (typeof b === 'string' && BADGES[b]) ? badge(b) : String(b)).join('');
}
/**
 * Score bug for a GAMES entry {a, b, sa, sb, week, type, year}.
 * opts: year, teams (true = that season's names | {id: name} | fn), seeds ({id: seed} | fn),
 * footer (text, or true for "WK n · FINAL"), badges ([kind] | [[kind, text]] | html),
 * card | compact | hero (variants; default is the plain .bug-row), a (manager id to show on side A),
 * attrs, key, cls, tag.
 */
export function scoreBug(g, {year, seeds, footer, card, compact, badges, teams, hero, a: aSide, attrs: at, key, cls = '', tag} = {}) {
  if (!g) return '';
  const flip = aSide && aSide === g.b;
  const A = flip ? g.b : g.a, B = flip ? g.a : g.b;
  const sA = flip ? g.sb : g.sa, sB = flip ? g.sa : g.sb;
  const tie = sA === sB;
  const winA = !tie && sA > sB;
  const yr = year != null ? year : g.year;
  const tm = teamFn(teams, yr);
  const seedOf = seeds == null ? null : typeof seeds === 'function' ? seeds : id => seeds[id];
  const winner = tie ? null : (winA ? A : B);
  const A_ = attrs(at);
  const tg = tag || (/\shref=/.test(A_) ? 'a' : /\sdata-/.test(A_) ? 'button' : 'div');
  const ty = tg === 'button' ? ' type="button"' : '';
  const dk = key != null ? ` data-key="${esc(key)}"` : '';
  const sc = v => Number(v).toFixed(2);
  const label = `${yr != null ? yr + ' ' : ''}${g.week ? `week ${g.week}, ` : ''}${name(A)} ${sc(sA)}, ${name(B)} ${sc(sB)}, ${tie ? 'tied' : name(winner) + ' won'}`;

  if (compact) {
    const cA = color(A).cls, cB = hueClose(A, B) ? 'mc-ink' : color(B).cls;
    const rd = !g.reg && g.type && RSHORT[g.type] ? (g.type === 'final' ? badge('final') : badge('round', RSHORT[g.type])) : '';
    return `<${tg}${ty} class="bug bug-compact${cls ? ' ' + cls : ''}"${dk} aria-label="${esc(label)}"${A_}><span class="bug-c a ${cA}${winA ? ' is-win' : tie ? ' is-tie' : ''}"><span class="n4">${score(sA)}</span></span><span class="bug-mid"><span>Wk ${esc(g.week)}</span>${rd}</span><span class="bug-c b ${cB}${!tie && !winA ? ' is-win' : tie ? ' is-tie' : ''}"><span class="n4">${score(sB)}</span></span></${tg}>`;
  }
  const side = (id, sc, st) => {
    const t = tm ? tm(id) : '';
    const sd = seedOf ? seedOf(id) : null;
    return `<span class="bug-side ${st}">${avatar(id, {size: hero ? 40 : 24})}<span class="bug-name"><b>${esc(name(id))}</b>${t ? `<span class="bug-team">${esc(t)}</span>` : ''}</span>${sd != null ? `<span class="bug-seed n5">${esc(sd)}</span>` : ''}<span class="bug-score ${hero ? 'n3' : 'n4'}">${score(sc)}</span><span class="bug-caret" aria-hidden="true"></span></span>`;
  };
  const stA = tie ? 'is-tie' : winA ? 'is-win' : 'is-lose';
  const stB = tie ? 'is-tie' : winA ? 'is-lose' : 'is-win';
  const ft = footer === true ? `WK ${g.week} · FINAL` : footer;
  const bl = badgeList(badges);
  const foot = (ft || bl) ? `<span class="bug-foot">${ft ? `<span class="ovl">${T(ft)}</span>` : ''}${bl}</span>` : '';
  const variant = card ? ' bug-card' : ' bug-row';
  const mc = card && winner ? ' ' + color(winner).cls : '';
  return `<${tg}${ty} class="bug${variant}${hero ? ' bug-hero' : ''}${mc}${cls ? ' ' + cls : ''}"${dk} aria-label="${esc(label)}"${A_}>${side(A, sA, stA)}${side(B, sB, stB)}${foot}</${tg}>`;
}

/** Tale-of-the-tape row: value A | label | value B. better: 'a' | 'b' | null. a/b/aSub/bSub are text (ui.raw for HTML). */
export function tape({label = '', a = '', b = '', better = null, aId, bId, aSub, bSub} = {}) {
  const cA = aId ? color(aId).cls : '';
  const cB = bId ? ((aId && hueClose(aId, bId)) ? 'mc-ink' : color(bId).cls) : '';
  const v = (side, val, sub, c, isB) => `<div class="tape-v tape-${side}${c ? ' ' + c : ''}${isB ? ' is-better' : ''}"><span class="tape-val">${T(val)}</span>${sub != null && sub !== '' ? `<span class="tape-sub">${T(sub)}</span>` : ''}</div>`;
  return `<div class="tape">${v('a', a, aSub, cA, better === 'a')}<div class="tape-label">${T(label)}</div>${v('b', b, bSub, cB, better === 'b')}</div>`;
}

const share01 = s => { let f = Number(s) || 0; if (f > 1) f /= 100; return Math.min(1, Math.max(0, f)); };
/** Split bar in manager colors. aShare: 0..1 (or 0..100). Side B is ink when the hues are within 35 degrees. */
export function splitBar(aId, bId, aShare, {label} = {}) {
  const f = share01(aShare), pa = Math.round(f * 100);
  const cA = color(aId).cls, cB = hueClose(aId, bId) ? 'mc-ink' : color(bId).cls;
  const lab = label || `${name(aId)} ${pa} percent, ${name(bId)} ${100 - pa} percent`;
  return `<div class="split" style="--a:${f}" data-a="${f <= 0 ? 0 : f >= 1 ? 1 : ''}"><span class="split-pct">${pa}%</span><span class="split-bar" role="img" aria-label="${esc(lab)}"><i class="split-a ${cA}"></i><i class="split-b ${cB}"></i></span><span class="split-pct">${100 - pa}%</span></div>`;
}
/** Re-split an existing .split (animated with scaleX from each segment's anchor). */
export function splitUpdate(el, aShare, {animate: an = true} = {}) {
  const s = el && (el.matches('.split') ? el : el.querySelector('.split'));
  if (!s) return;
  const old = parseFloat(getComputedStyle(s).getPropertyValue('--a')) || 0;
  const f = share01(aShare), pa = Math.round(f * 100);
  s.style.setProperty('--a', f);
  s.dataset.a = f <= 0 ? 0 : f >= 1 ? 1 : '';
  const p = s.querySelectorAll('.split-pct');
  if (p[0]) p[0].textContent = pa + '%';
  if (p[1]) p[1].textContent = (100 - pa) + '%';
  if (!an || RM || Math.abs(old - f) < .001) return;
  const segA = s.querySelector('.split-a'), segB = s.querySelector('.split-b');
  if (segA && f > 0) animate(segA, [{transform: `scaleX(${Math.max(.01, old / f)})`}, {transform: 'none'}], {spring: 'smooth'});
  if (segB && f < 1) animate(segB, [{transform: `scaleX(${Math.max(.01, (1 - old) / (1 - f))})`}, {transform: 'none'}], {spring: 'smooth'});
}
/** Entrance for a split bar: scaleX from the center. */
export function splitIn(el) {
  const bar = el && (el.matches('.split-bar') ? el : el.querySelector('.split-bar'));
  if (bar && !RM) return animate(bar, [{transform: 'scaleX(0)'}, {transform: 'none'}], {spring: 'smooth'});
}

// Three-arc ring
const rad = d => d * Math.PI / 180;
/**
 * Three-arc ring. parts = [{frac 0..1, perfect, doneZero}] x 3 (College, Mystery, Grid).
 * opts: size/stroke (defaults 200/16; mini = 24/3), center (HTML slot), label (aria-label).
 */
export function ring(parts = [], {size, stroke, center = '', mini = false, label, cls = ''} = {}) {
  const S = size || (mini ? 24 : 200), W = stroke || (mini ? 3 : 16);
  const r = (S - W) / 2, c = S / 2;
  const trim = (W / 2) / r; // radians eaten by each round cap
  let tracks = '', fills = '';
  for (let i = 0; i < 3; i++) {
    const a0 = rad(4 + i * 120) + trim, a1 = rad(4 + i * 120 + 112) - trim;
    const x0 = c + r * Math.sin(a0), y0 = c - r * Math.cos(a0), x1 = c + r * Math.sin(a1), y1 = c - r * Math.cos(a1);
    const d = `M${x0.toFixed(3)} ${y0.toFixed(3)}A${r} ${r} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
    const len = +(r * (a1 - a0)).toFixed(3);
    const p = parts[i] || {};
    const f = Math.min(1, Math.max(0, Number(p.frac) || 0));
    tracks += `<path class="ring-track${p.doneZero ? ' is-zero' : ''}" d="${d}" stroke-width="${W}"/>`;
    fills += `<path class="ring-fill${p.perfect ? ' is-perfect' : ''}${f <= 0 ? ' is-empty' : ''}" d="${d}" stroke-width="${W}" data-len="${len}" stroke-dasharray="${len} ${len}" style="stroke-dashoffset:${(len * (1 - f)).toFixed(3)}"/>`;
  }
  const a11y = label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"';
  return `<div class="ring${mini ? ' ring-mini' : ''}${cls ? ' ' + cls : ''}" style="--rs:${S}px"${a11y} data-ring><svg viewBox="0 0 ${S} ${S}" aria-hidden="true" focusable="false">${tracks}${fills}</svg>${center ? `<div class="ring-center">${center}</div>` : ''}</div>`;
}
/** Update a ring in place. animate: 700ms ease-out-expo on stroke-dashoffset. from: 'zero' animates from empty. */
export function ringUpdate(el, parts = [], {animate: an = true, from, duration = 700} = {}) {
  if (!el) return;
  const root = el.matches && el.matches('.ring') ? el : (el.closest && el.closest('.ring')) || (el.querySelector && el.querySelector('.ring'));
  if (!root) return;
  const fills = root.querySelectorAll('.ring-fill'), tracks = root.querySelectorAll('.ring-track');
  const anims = [];
  fills.forEach((f, i) => {
    const p = parts[i] || {};
    const len = +f.dataset.len;
    const frac = Math.min(1, Math.max(0, Number(p.frac) || 0));
    const target = len * (1 - frac);
    const cur = from === 'zero' ? len : (parseFloat(f.style.strokeDashoffset) || 0);
    f.classList.toggle('is-perfect', !!p.perfect);
    if (tracks[i]) tracks[i].classList.toggle('is-zero', !!p.doneZero);
    f.classList.toggle('is-empty', frac <= 0);
    f.style.strokeDashoffset = target.toFixed(3);
    if (an && !RM && Math.abs(cur - target) > .01) {
      anims.push(animate(f, [{strokeDashoffset: cur}, {strokeDashoffset: target}], {duration, easing: 'cubic-bezier(.16,1,.3,1)'}));
    }
  });
  return Promise.all(anims.map(a => a.finished.catch(() => {})));
}

/** Empty state. action: {label, kind='secondary', attrs, icon, href}. */
export function empty({icon: ic = 'info', title, body, action} = {}) {
  return `<div class="empty">${icon(ic)}${title ? `<h3 class="empty-title">${T(title)}</h3>` : ''}${body ? `<p class="empty-body">${T(body)}</p>` : ''}${action ? button(Object.assign({kind: 'secondary'}, action, {size: 'l'})) : ''}</div>`;
}

/** Skeleton blocks. kind: rows | cards | tiles | ring | title | lines | bugs. label: screen-reader text. */
export function skeleton(kind = 'rows', n = 3, {label} = {}) {
  let h = '';
  const W = ['72%', '54%', '64%', '48%', '80%', '58%'];
  if (kind === 'rows') {
    h = `<div class="sk-rows">${Array.from({length: n}, (_, i) => `<div class="sk-row"><span class="sk sk-circle" style="width:36px;height:36px;flex:none"></span><span class="sk-col"><span class="sk sk-line" style="width:${W[i % 6]}"></span><span class="sk sk-line" style="width:${W[(i + 3) % 6]};height:10px;opacity:.7"></span></span></div>`).join('')}</div>`;
  } else if (kind === 'cards') {
    h = Array.from({length: n}, () => `<span class="sk sk-card"></span>`).join('');
  } else if (kind === 'bugs') {
    h = Array.from({length: n}, () => `<span class="sk sk-card" style="height:92px"></span>`).join('');
  } else if (kind === 'tiles') {
    h = `<div class="sk-tiles">${Array.from({length: n}, () => '<span class="sk"></span>').join('')}</div>`;
  } else if (kind === 'ring') {
    h = `<div class="sk-ring"><span class="sk"></span></div>`;
  } else if (kind === 'title') {
    h = `<span class="sk sk-line" style="width:38%;height:12px"></span><span class="sk sk-title"></span>`;
  } else {
    h = Array.from({length: n}, (_, i) => `<span class="sk sk-line" style="width:${W[i % 6]}"></span>`).join('');
  }
  return `<div class="skeleton" aria-busy="true">${label ? `<span class="sr-only">${T(label)}</span>` : ''}<div class="skeleton" aria-hidden="true">${h}</div></div>`;
}

// ============================================================================ Springs and motion
/** Spring solver (spec 5.1). mass 1, x 0→1, v0 in units/s. Returns {easing: 'linear(...)', duration}. */
export function spring({k, c, v0 = 0}) {
  let x = 0, v = v0, t = 0;
  const s = [0];
  while (t < 1500) {
    for (let i = 0; i < 17; i++) { const a = -k * (x - 1) - c * v; v += a / 1000; x += v / 1000; }
    t += 1000 / 60;
    s.push(+x.toFixed(4));
    if (Math.abs(1 - x) < 0.002 && Math.abs(v) < 0.02) break;
  }
  s[s.length - 1] = 1;
  return {easing: `linear(${s.join(',')})`, duration: Math.round(t)};
}
const SPRING_P = {snappy: {k: 520, c: 40}, smooth: {k: 380, c: 39}, bouncy: {k: 280, c: 20}};
const CUBIC = {snappy: ['cubic-bezier(.2,.9,.3,1)', 300], smooth: ['cubic-bezier(.32,.72,0,1)', 420], bouncy: ['cubic-bezier(.34,1.56,.64,1)', 500]};
const EASE_OUT_CSS = 'cubic-bezier(.22,1,.36,1)';
/** {snappy, smooth, bouncy}: each {easing, duration}. linear() springs, or the cubic fallbacks. */
export const springs = {};
for (const k of Object.keys(SPRING_P)) springs[k] = LINEAR_OK ? spring(SPRING_P[k]) : {easing: CUBIC[k][0], duration: CUBIC[k][1]};
/** Writes --spring-<name> and --spring-<name>-dur on :root (cubic fallbacks stay when linear() is unsupported). */
export function installSpringVars(root = DOC) {
  if (!LINEAR_OK) return;
  for (const k of Object.keys(springs)) {
    root.style.setProperty(`--spring-${k}`, springs[k].easing);
    root.style.setProperty(`--spring-${k}-dur`, springs[k].duration + 'ms');
  }
}

// Busy tracking: animations in flight + manual holds; whenIdle waits for 0 and 150ms without scrolling.
let busyN = 0;
let lastScroll = 0;
export const busy = {
  inc() { busyN++; },
  dec() { busyN = Math.max(0, busyN - 1); },
  get count() { return busyN; }
};
/** Runs fn once nothing animates and nothing scrolled for 150ms. Returns a cancel function. */
export function whenIdle(fn) {
  let t = 0, dead = false;
  const check = () => {
    if (dead) return;
    const q = performance.now() - lastScroll;
    if (busyN === 0 && q >= 150) { dead = true; fn(); return; }
    t = setTimeout(check, busyN ? 100 : Math.max(16, 155 - q));
  };
  t = setTimeout(check, 0);
  return () => { dead = true; clearTimeout(t); };
}
/**
 * False while el sits in a subtree skipped by content-visibility (a hidden tab layer). Observer callbacks ignore
 * records from there, so a hidden screen's collapse, pinned, stuck, spy and count-up states never change while hidden.
 */
export const rendered = el => !el || typeof el.checkVisibility !== 'function' || el.checkVisibility();
/** requestIdleCallback with a setTimeout(200) fallback. */
export function onIdle(fn, timeout = 2000) {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback(fn, {timeout});
  return setTimeout(fn, 200);
}

const WC = new WeakMap();
function willChange(el, props, d) {
  const m = WC.get(el) || new Map();
  props.forEach(p => m.set(p, (m.get(p) || 0) + d));
  for (const [p, n] of m) if (n <= 0) m.delete(p);
  WC.set(el, m);
  el.style.willChange = m.size ? [...m.keys()].join(', ') : '';
}
const camel = p => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const cssProp = p => p === 'strokeDashoffset' ? 'stroke-dashoffset' : p.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
function propsOf(kf) {
  const ks = new Set();
  const skip = ['offset', 'easing', 'composite'];
  if (Array.isArray(kf)) kf.forEach(f => Object.keys(f).forEach(k => { if (!skip.includes(k)) ks.add(cssProp(camel(k))); }));
  else if (kf) Object.keys(kf).forEach(k => { if (!skip.includes(k)) ks.add(cssProp(camel(k))); });
  return [...ks].filter(p => ['transform', 'opacity', 'scale', 'rotate', 'translate'].includes(p));
}
function opacityOnly(kf) {
  if (Array.isArray(kf)) {
    if (!kf.length || !kf.every(f => 'opacity' in f)) return null;
    return kf.map(f => ({opacity: f.opacity, ...(f.offset != null ? {offset: f.offset} : {})}));
  }
  if (kf && kf.opacity) return {opacity: kf.opacity};
  return null;
}
function doneAnim(el) {
  try { if (el && el.animate) return el.animate([], {duration: 0}); } catch (_) {}
  return {finished: Promise.resolve(), ready: Promise.resolve(), finish() {}, cancel() {}, pause() {}, play() {}, addEventListener() {}, removeEventListener() {}, playState: 'finished'};
}

/**
 * WAAPI wrapper. opts: spring ('snappy'|'smooth'|'bouncy'|{k,c}), v0 (units/s, seeds the spring), duration, easing,
 * delay, fill, rmKeep (keep motion under reduced motion). Handles will-change and busy counting.
 * Reduced motion: collapses to an opacity-only animation (<=200ms) or none. The end state is NOT kept unless fill
 * is set: set the final inline style yourself, then animate from the old value.
 */
export function animate(el, keyframes, o = {}) {
  if (!el || !el.animate) return doneAnim(null);
  let {spring: sp, v0 = 0, duration = 240, easing = 'ease', delay = 0, fill = 'none', iterations = 1, direction = 'normal', rmKeep} = o;
  if (RM && !rmKeep) {
    const kf = opacityOnly(keyframes);
    if (!kf) return doneAnim(el);
    keyframes = kf; sp = null; duration = Math.min(duration || 200, 200); easing = 'linear';
  }
  if (sp) {
    let s;
    if (typeof sp === 'object') s = LINEAR_OK ? spring({...sp, v0}) : {easing: CUBIC.smooth[0], duration: CUBIC.smooth[1]};
    else if (v0 && LINEAR_OK && SPRING_P[sp]) s = spring({...SPRING_P[sp], v0: Math.max(-40, Math.min(40, v0))});
    else s = springs[sp] || springs.smooth;
    easing = s.easing; duration = s.duration;
  }
  const props = propsOf(keyframes);
  willChange(el, props, 1);
  busyN++;
  let a;
  try { a = el.animate(keyframes, {duration, easing, delay, fill, iterations, direction}); }
  catch (_) { a = el.animate(keyframes, {duration, easing: 'cubic-bezier(.32,.72,0,1)', delay, fill, iterations, direction}); }
  let ended = false;
  const end = () => { if (ended) return; ended = true; busyN = Math.max(0, busyN - 1); willChange(el, props, -1); };
  a.addEventListener('finish', end);
  a.addEventListener('cancel', end);
  return a;
}

/** FLIP reorder: measure keyed children, run mutate(), animate moved ones on smooth, fade new ones in. */
export function flip(container, mutate, {selector = '[data-key]', spring: sp = 'smooth', fade = true} = {}) {
  if (!container) { mutate && mutate(); return Promise.resolve(); }
  const first = new Map();
  container.querySelectorAll(selector).forEach(el => { const k = el.dataset.key; if (k != null) first.set(k, el.getBoundingClientRect()); });
  mutate && mutate();
  // Reduced motion (spec 5.8): nothing glides; the reordered container cross-fades in (150 ms, opacity) as the cue.
  if (RM) return animate(container, [{opacity: 0}, {opacity: 1}], {duration: 150, easing: 'linear'}).finished.catch(() => {});
  const anims = [];
  container.querySelectorAll(selector).forEach(el => {
    const k = el.dataset.key, r0 = first.get(k);
    const r1 = el.getBoundingClientRect();
    if (r0) {
      const dx = r0.left - r1.left, dy = r0.top - r1.top;
      if (Math.abs(dx) > .5 || Math.abs(dy) > .5) anims.push(animate(el, [{transform: `translate(${dx}px,${dy}px)`}, {transform: 'none'}], {spring: sp}));
    } else if (fade && k != null) {
      anims.push(animate(el, [{opacity: 0}, {opacity: 1}], {duration: 240, easing: 'ease-out'}));
    }
  });
  return Promise.all(anims.map(a => a.finished.catch(() => {})));
}

/**
 * Content cross-fade after a segment/chip change. A real dissolve: a snapshot of the old content (an inert clone laid
 * over the same box) fades 1→0 over `duration` while the new content fades .2→1 slightly slower, so the swap never
 * blinks through the black canvas. Very large regions skip the clone and fade from .4 instead.
 */
export function crossfade(el, mutate, {duration = 120} = {}) {
  if (!el || !el.isConnected || !el.parentElement || !el.getClientRects().length) {
    mutate && mutate();
    return el ? animate(el, [{opacity: .4}, {opacity: 1}], {duration: duration + 40, easing: EASE_OUT_CSS}) : doneAnim(null);
  }
  let ghost = null, box = null;
  if (el.getElementsByTagName('*').length <= 700) {
    box = el.getBoundingClientRect();
    ghost = el.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    // The snapshot must never be wired (count-ups, the collapse sentinel, FLIP keys, stagger).
    for (const a of ['data-count-to', 'data-collapse', 'data-key', 'data-enter']) {
      ghost.removeAttribute(a);
      ghost.querySelectorAll(`[${a}]`).forEach(n => n.removeAttribute(a));
    }
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
  }
  mutate && mutate();
  const inc = animate(el, [{opacity: ghost ? .2 : .4}, {opacity: 1}], {duration: duration + 40, easing: EASE_OUT_CSS});
  if (ghost && el.isConnected && el.parentElement) {
    // Same parent, appended last: every scoped selector that styled the old content still matches the snapshot.
    el.parentElement.appendChild(ghost);
    ghost.style.cssText += `;position:absolute;left:0;top:0;margin:0;pointer-events:none;z-index:1;box-sizing:border-box;`
      + `width:${box.width}px;height:${box.height}px;`;
    // Measure where left/top 0 landed (whatever the containing block is), then shift onto the old box.
    const g = ghost.getBoundingClientRect();
    ghost.style.left = (box.left - g.left) + 'px';
    ghost.style.top = (box.top - g.top) + 'px';
    const out = animate(ghost, [{opacity: 1}, {opacity: 0}], {duration, easing: 'linear', fill: 'forwards'});
    const rm = () => ghost.remove();
    out.finished.then(rm, rm);
    setTimeout(rm, duration + 400); // no frames (hidden page): never leave the snapshot behind
  }
  return inc;
}

// Count-ups: once per key per session, at 60% visibility, ease-out-expo.
const counted = new Set();
/** Count el's number from `from` to `to`. format: see statTile. The final value is exposed as aria-label at once. */
export function countUp(el, to, {from = 0, duration = 700, format, key} = {}) {
  if (!el) return Promise.resolve();
  to = Number(to);
  const f = fmtFn(fmtKey(format, to), to);
  const fin = f(to, true);
  el.setAttribute('aria-label', stripTags(fin));
  if (!el.getAttribute('role')) el.setAttribute('role', 'img');
  if (el._cuIO) { el._cuIO.disconnect(); el._cuIO = null; }
  if (el._cuRaf) { cancelAnimationFrame(el._cuRaf); el._cuRaf = 0; }
  if (el._cuBusy) { el._cuBusy = false; busyN = Math.max(0, busyN - 1); } // a count cut short by a newer one
  if (RM || (key && counted.has(key)) || from === to || !isFinite(to)) { el.innerHTML = fin; return Promise.resolve(); }
  el.innerHTML = f(from, false);
  return new Promise(res => {
    const go = () => {
      if (key) counted.add(key);
      busyN++;
      el._cuBusy = true;
      const t0 = performance.now();
      const step = now => {
        const t = Math.min(1, (now - t0) / duration);
        if (t >= 1 || !el.isConnected) { el.innerHTML = fin; el._cuRaf = 0; if (el._cuBusy) { el._cuBusy = false; busyN = Math.max(0, busyN - 1); } res(); return; }
        const e = 1 - Math.pow(2, -10 * t);
        el.innerHTML = f(from + (to - from) * e, false);
        el._cuRaf = requestAnimationFrame(step);
      };
      el._cuRaf = requestAnimationFrame(step);
    };
    if (typeof IntersectionObserver !== 'function') { go(); return; }
    // "Visible" leaves out the nav bar and (inside a tab) the tab bar, which float over the screen's content.
    const scr = el.closest('.screen');
    const nav = scr && scr.querySelector(':scope > .nav');
    const tb = el.closest('.tab-layer') ? document.getElementById('tabbar') : null;
    const mt = nav ? nav.offsetHeight : 0, mb = tb ? tb.offsetHeight : 0;
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting && e.intersectionRatio >= .6 && rendered(e.target))) { io.disconnect(); el._cuIO = null; go(); }
    }, {threshold: [0, .6, 1], rootMargin: `-${mt}px 0px -${mb}px 0px`});
    el._cuIO = io;
    io.observe(el);
  });
}
/** True once countUp ran (or was skipped) for this key this session. */
export const countedKey = key => counted.has(key);

/** Odometer: stacked digit columns roll from `from` to `to` on smooth (streaks, Rivals series). */
export function odometer(el, from, to) {
  if (!el) return Promise.resolve();
  const a0 = String(Math.max(0, Math.round(Number(from) || 0))), b0 = String(Math.max(0, Math.round(Number(to) || 0)));
  el.setAttribute('aria-label', b0);
  // A newer roll on the same element wins: an older one that finishes later must not write its stale value.
  const seq = el._odoSeq = (el._odoSeq || 0) + 1;
  if (RM || a0 === b0) { el.textContent = b0; return Promise.resolve(); }
  const L = Math.max(a0.length, b0.length);
  const a = a0.padStart(L, ' '), b = b0.padStart(L, ' ');
  const col = '0123456789'.split('').map(d => `<span>${d}</span>`).join('') + '<span>&nbsp;</span>';
  el.innerHTML = `<span class="odo" aria-hidden="true">${[...b].map(() => `<span class="odo-col">${col}</span>`).join('')}</span>`;
  const anims = [];
  el.querySelectorAll('.odo-col').forEach((c, i) => {
    const d0 = a[i] === ' ' ? 10 : +a[i], d1 = b[i] === ' ' ? 10 : +b[i];
    c.style.transform = `translateY(${-d1}em)`;
    if (d0 !== d1) anims.push(animate(c, [{transform: `translateY(${-d0}em)`}, {transform: `translateY(${-d1}em)`}], {spring: 'smooth'}));
  });
  return Promise.all(anims.map(x => x.finished.catch(() => {}))).then(() => { if (el._odoSeq === seq && el.querySelector('.odo')) el.textContent = b0; });
}

/** First 8 nodes (or [data-enter] inside a container) fade up 12px, 320ms ease-out, 24ms apart. */
export function stagger(nodes, {step = 24, max = 8, y = 12, duration = 320} = {}) {
  if (!nodes || RM) return;
  let list = nodes instanceof Element ? [...nodes.querySelectorAll('[data-enter]')] : [...nodes];
  // A [data-enter] inside another one moves with its parent (never twice).
  const set = new Set(list);
  list = list.filter(n => { for (let p = n.parentElement; p; p = p.parentElement) if (set.has(p)) return false; return true; });
  const go = (n, i) => animate(n, [{opacity: 0, transform: `translateY(${y}px)`}, {opacity: 1, transform: 'none'}], {duration, easing: EASE_OUT_CSS, delay: i * step, fill: 'backwards'});
  list.slice(0, max).forEach(go);
  // Items past the cap that are already on screen enter with the last one, never before it (no holes mid-list).
  if (list.length > max) {
    const H = innerHeight;
    list.slice(max).forEach(n => { const r = n.getBoundingClientRect(); if (r.bottom > 0 && r.top < H && r.height) go(n, max - 1); });
  }
}

/** "+40" rises 24px and fades over 600ms from an element. cls: extra class (e.g. 'gold', 'wrong'). */
export function floatText(fromEl, text, {cls = ''} = {}) {
  if (!fromEl) return;
  const r = fromEl.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float-text' + (cls ? ' ' + cls : '');
  f.setAttribute('aria-hidden', 'true');
  f.textContent = text;
  document.body.appendChild(f);
  f.style.left = (r.left + r.width / 2 - f.offsetWidth / 2) + 'px';
  f.style.top = (r.top + r.height / 2 - f.offsetHeight / 2 - 8) + 'px';
  const a = animate(f, [{transform: 'translateY(0)', opacity: 1}, {transform: 'translateY(-24px)', opacity: 0}], {duration: 600, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards'});
  const kill = () => f.remove();
  a.finished.then(kill, kill);
  setTimeout(kill, 900);
  return a;
}

/** Wrong-answer shake (translateX 0,-8,8,-5,5,0 over 360ms). Reduced motion: a 200ms red flash
 *  (a fixed overlay over el whose opacity fades 1 → 0; never an animated box-shadow). */
export function shake(el) {
  if (!el) return doneAnim(null);
  if (RM) {
    const r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'flash-wrong';
    f.setAttribute('aria-hidden', 'true');
    let radius = '';
    try { radius = getComputedStyle(el).borderRadius; } catch (_) {}
    Object.assign(f.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: radius});
    document.body.appendChild(f);
    const a = animate(f, [{opacity: 1}, {opacity: 0}], {duration: 200, easing: 'linear', fill: 'forwards'});
    const kill = () => f.remove();
    a.finished.then(kill, kill);
    setTimeout(kill, 600);
    return a;
  }
  return animate(el, [{transform: 'translateX(0)'}, {transform: 'translateX(-8px)'}, {transform: 'translateX(8px)'}, {transform: 'translateX(-5px)'}, {transform: 'translateX(5px)'}, {transform: 'translateX(0)'}], {duration: 360, easing: 'ease-in-out'});
}

/** Flip: rotate to 90deg, call onHalf() (swap content), rotate back. axis 'x' | 'y'; half = ms per half (170). */
export async function flipCard(el, {axis = 'y', onHalf, half = 170, perspective = 600} = {}) {
  if (!el) { onHalf && onHalf(); return; }
  if (RM) {
    await animate(el, [{opacity: 1}, {opacity: 0}], {duration: 75, fill: 'forwards'}).finished.catch(() => {});
    onHalf && onHalf();
    el.getAnimations().forEach(a => a.cancel());
    await animate(el, [{opacity: 0}, {opacity: 1}], {duration: 75}).finished.catch(() => {});
    return;
  }
  const R = axis === 'x' ? 'rotateX' : 'rotateY';
  const a1 = animate(el, [{transform: `perspective(${perspective}px) ${R}(0deg)`}, {transform: `perspective(${perspective}px) ${R}(90deg)`}], {duration: half, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards'});
  await a1.finished.catch(() => {});
  onHalf && onHalf();
  const a2 = animate(el, [{transform: `perspective(${perspective}px) ${R}(-90deg)`}, {transform: `perspective(${perspective}px) ${R}(0deg)`}], {duration: half, easing: 'cubic-bezier(0,0,.2,1)'});
  a1.cancel();
  await a2.finished.catch(() => {});
}

/** Bouncy pop-in (stamps, crowns, badges): scale 1.6→1 + fade in. Uses the independent `scale` property,
 *  so a CSS `rotate` on the element is kept. Reduced motion: appears without motion. */
export function stamp(el, {from = 1.6} = {}) {
  if (!el) return doneAnim(null);
  if (RM) return doneAnim(el);
  return animate(el, [{scale: String(from), opacity: 0}, {scale: '1', opacity: 1}], {spring: 'bouncy'});
}

/** Confetti burst from a rect (single canvas, DPR<=2, one rAF loop). Halved in lite, none in reduced motion. */
export function confetti(rect, {colors = ['#7CF058', '#FFCC4D', '#FFFFFF'], count = 60} = {}) {
  if (RM) return Promise.resolve();
  if (LITE) count = Math.ceil(count / 2);
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.className = 'confetti-canvas';
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const cx = cv.getContext('2d');
  cx.scale(dpr, dpr);
  const r = rect || {left: W / 2 - 40, top: H * .35, width: 80, height: 10};
  const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  const P = Array.from({length: count}, (_, i) => {
    const ang = -Math.PI / 2 + (Math.random() - .5) * Math.PI * .95;
    const sp = 7 + Math.random() * 10;
    return {x: ox + (Math.random() - .5) * r.width * .8, y: oy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2,
      rot: Math.random() * 6.28, vr: (Math.random() - .5) * .35, w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
      tilt: Math.random() * 6.28, vt: .08 + Math.random() * .18, c: colors[i % colors.length]};
  });
  busyN++;
  return new Promise(res => {
    const t0 = performance.now();
    let last = t0;
    const frame = now => {
      const dt = Math.min(3, (now - last) / 16.667); last = now;
      cx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of P) {
        p.vx *= Math.pow(.985, dt); p.vy = p.vy * Math.pow(.985, dt) + .32 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.tilt += p.vt * dt;
        if (p.y < H + 30) alive++;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, Math.cos(p.tilt));
        cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      }
      if (alive && now - t0 < 4000) requestAnimationFrame(frame);
      else { cv.remove(); busyN = Math.max(0, busyN - 1); res(); }
    };
    requestAnimationFrame(frame);
  });
}

/** Avatar morph: a fixed clone of toEl flies from fromRect to toEl's rect (translate + scale, smooth).
 *  opts.toRect overrides the measured target rect. Skipped in lite and reduced motion. */
export function morph(fromRect, toEl, {toRect} = {}) {
  if (!fromRect || !toEl || RM || LITE) return Promise.resolve();
  const to = toRect || toEl.getBoundingClientRect();
  if (!to.width || !fromRect.width) return Promise.resolve();
  const clone = toEl.cloneNode(true);
  clone.classList.add('morph-clone');
  clone.removeAttribute('id');
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px'});
  document.body.appendChild(clone);
  const prev = toEl.style.visibility;
  toEl.style.visibility = 'hidden';
  const sx = fromRect.width / to.width, sy = fromRect.height / to.height;
  const dx = fromRect.left - to.left, dy = fromRect.top - to.top;
  const a = animate(clone, [{transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`}, {transform: 'none'}], {spring: 'smooth'});
  const done = () => { clone.remove(); toEl.style.visibility = prev; };
  return a.finished.then(done, done);
}

// ============================================================================ Feedback
const HAPTIC = {selection: 6, light: 10, medium: 16, success: [10, 50, 16], warning: [18, 40, 18], error: [24, 32, 24], celebrate: [12, 40, 12, 40, 30]};
/** true when navigator.vibrate exists (the You sheet hides the Haptics switch otherwise). */
export const HAPTICS_SUPPORTED = typeof navigator !== 'undefined' && 'vibrate' in navigator;
/** Haptic pattern (spec 5.7). Only inside user gestures, only when gg-haptics isn't '0'. */
export function haptic(kind = 'light') {
  if (!HAPTICS_SUPPORTED) return;
  if (lsGet('gg-haptics') === '0') return;
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  try { navigator.vibrate(HAPTIC[kind] || 10); } catch (_) {}
}

function layer(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    if (id === 'toasts') { el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); }
    if (id === 'announcer') { el.className = 'sr-only'; el.setAttribute('aria-live', 'polite'); }
    (document.getElementById('app') || document.body).appendChild(el);
  }
  return el;
}

/** Screen-reader announcement through #announcer. */
export function announce(text) {
  const el = layer('announcer');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = String(text || ''); });
}

// Toasts: top capsule, queued one at a time, swipe up to dismiss.
const tq = [];
let tCur = null;
/** toast(msg, {icon, action: {label, fn}, duration=2200}) → {dismiss()} */
export function toast(msg, {icon: ic, action, duration = 2200} = {}) {
  const t = {msg, ic, action, duration, hide: null};
  tq.push(t);
  if (!tCur) nextToast();
  return {dismiss() { const i = tq.indexOf(t); if (i >= 0) tq.splice(i, 1); else if (t.hide) t.hide(); }};
}
function nextToast() {
  const t = tq.shift();
  tCur = t || null;
  if (!t) return;
  const host = layer('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (t.action ? ' has-act' : '');
  el.innerHTML = `${t.ic ? icon(t.ic) : ''}<span class="toast-msg">${esc(t.msg)}</span>${t.action ? `<button type="button" class="toast-act">${esc(t.action.label)}</button>` : ''}`;
  host.appendChild(el);
  animate(el, [{transform: 'translateY(-120%) scale(.9)', opacity: 0}, {transform: 'none', opacity: 1}], {spring: 'bouncy'});
  let timer = 0, hidden = false;
  const hide = (fromY = 0) => {
    if (hidden) return;
    hidden = true;
    clearTimeout(timer);
    const a = animate(el, [{transform: `translateY(${fromY}px)`, opacity: 1}, {transform: 'translateY(-130%)', opacity: RM ? 0 : 1}], {duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards'});
    const fin = () => { el.remove(); if (tCur === t) nextToast(); };
    a.finished.then(fin, fin);
  };
  t.hide = hide;
  const arm = ms => { clearTimeout(timer); timer = setTimeout(() => hide(), ms); };
  arm(t.duration);
  const act = el.querySelector('.toast-act');
  if (act) act.addEventListener('click', e => { e.stopPropagation(); try { t.action.fn && t.action.fn(); } finally { hide(); } });
  // Swipe up to dismiss
  let sy = 0, dy = 0, t0 = 0, dragging = false;
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.toast-act')) return;
    dragging = true; sy = e.clientY; dy = 0; t0 = performance.now();
    clearTimeout(timer);
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const d = e.clientY - sy;
    dy = d < 0 ? d : d / 4;
    el.style.transform = `translateY(${dy}px)`;
  });
  const up = () => {
    if (!dragging) return;
    dragging = false;
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy < -16 || v < -.3) { el.style.transform = ''; hide(dy); }
    else { const from = dy; el.style.transform = ''; animate(el, [{transform: `translateY(${from}px)`}, {transform: 'none'}], {spring: 'snappy'}); arm(1500); }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

/** Copy text: Clipboard API, then a textarea + execCommand fallback (the old shareResults flow). */
export async function copyText(text, {fallbackTextarea} = {}) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  let ta = fallbackTextarea, temp = false;
  if (!ta) {
    ta = document.createElement('textarea');
    ta.setAttribute('readonly', '');
    Object.assign(ta.style, {position: 'fixed', top: '0', left: '0', width: '1px', height: '1px', opacity: '0', fontSize: '16px'});
    document.body.appendChild(ta);
    temp = true;
  }
  ta.hidden = false;
  ta.value = text;
  try { ta.focus({preventScroll: true}); } catch (_) { ta.focus(); }
  ta.select();
  try { ta.setSelectionRange(0, text.length); } catch (_) {}
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  if (temp) ta.remove();
  return ok;
}
/**
 * Share sheet. Call synchronously inside the tap handler (keeps iOS user activation).
 * Resolves 'shared' | 'copied' | 'unavailable' | 'cancelled'.
 */
export async function share({text = '', url, files} = {}) {
  const data = {};
  if (text) data.text = text;
  if (url) data.url = url;
  try {
    if (files && files.length && navigator.canShare && navigator.canShare({files})) {
      await navigator.share(Object.assign({files}, data));
      return 'shared';
    }
    if (navigator.share) { await navigator.share(data); return 'shared'; }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  const ok = await copyText(url ? `${text}${text ? ' ' : ''}${url}` : text);
  return ok ? 'copied' : 'unavailable';
}

// ============================================================================ Safe area probe
let safeTopPx = null;
function safeTop() {
  if (safeTopPx != null) return safeTopPx;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
  document.body.appendChild(p);
  safeTopPx = p.offsetHeight || 0;
  p.remove();
  return safeTopPx;
}
addEventListener('resize', () => { safeTopPx = null; }, {passive: true});
addEventListener('orientationchange', () => { safeTopPx = null; }, {passive: true});

// ============================================================================ Sheets
let HIST = null;
/** app.js registers {pushOverlay(rec) → id, back()}; sheets push a history entry through it. */
export function _setHistory(h) { HIST = h; }
const sheets = [];
let sheetSeq = 0;
/** Number of sheets currently open (not closing). */
export const sheetCount = () => sheets.filter(s => s.state === 'open').length;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const canFocus = el => !!(el && el.isConnected && typeof el.focus === 'function' && el !== document.body && !el.closest('[inert], [hidden], [data-under]') && el.getClientRects().length);
// The screen the reader is looking at: the cover's screen, else the top screen of the visible tab.
function visibleScreenEl() {
  const cov = [...document.querySelectorAll('#covers .cover > .screen')].filter(canFocus);
  if (cov.length) return cov[cov.length - 1];
  const tops = [...document.querySelectorAll('#stage > .tab-layer:not([hidden]) > .screen:not([data-under])')].filter(canFocus);
  return tops.length ? tops[tops.length - 1] : null;
}
// A sheet's exit finishes even when the page produces no animation frames (a background tab), so the background
// never stays inert: the same guard app.js keeps on screen transitions.
const guarded = p => Promise.race([p, new Promise(r => setTimeout(r, 1000))]);

let inertSaved = null;
function setBackgroundInert(on) {
  const els = ['stage', 'tabbar', 'covers'].map(id => document.getElementById(id)).filter(Boolean);
  if (on) {
    if (!inertSaved) inertSaved = els.map(el => [el, el.inert]);
    els.forEach(el => { el.inert = true; });
  } else if (inertSaved) {
    inertSaved.forEach(([el, was]) => { el.inert = was; });
    inertSaved = null;
  }
}
/** Absolute share link for an app path ("/matchup/evan-vs-mason"), built from the current location. */
export const absLink = path => `${location.origin}${location.pathname}#${path || '/puzzles'}`;

/**
 * Bottom sheet with full physics (spec 5.6).
 * opts: title (text) | header (HTML for the title slot), body (HTML), detents ['medium','large'] (also 'fit' or px heights),
 * detent (initial), cls (e.g. 'sh-picker'), onClose(), focus (element or selector to focus synchronously), label, chrome
 * (false = no header row), returnFocus (element, or fn → element, focused on close instead of the trigger).
 * Returns {el, body, close(), setDetent(d)}. Elements with [data-sheet-close] close it.
 * Focus returns to returnFocus, else the trigger (the focused element at open, or the element tapped just before:
 * iOS does not focus tapped buttons), else the sheet below, else the visible screen.
 */
export function openSheet(o = {}) {
  const {title = '', header, body = '', cls = '', onClose, focus, label, chrome = true, returnFocus} = o;
  const detents = (o.detents && o.detents.length) ? o.detents : ['medium', 'large'];
  const isFit = detents.includes('fit');
  let cur = o.detent || detents[0];
  const host = layer('overlays');
  const byPointer = !!lastPress && performance.now() - lastPress.at < 1500 && lastKeyAt < lastPress.at;
  let trigger = document.activeElement;
  // iOS never focuses a tapped button: focus is still on <body> or on a container (the screen) holding it.
  if (byPointer && lastPress.el.isConnected && (!trigger || trigger === document.body || trigger === DOC || (trigger !== lastPress.el && trigger.contains(lastPress.el)))) trigger = lastPress.el;
  const k = sheets.length;
  const uid = 'sheet' + (++sheetSeq);

  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  scrim.style.zIndex = String(2 * k + 1);
  const sh = document.createElement('div');
  sh.className = `sheet${cls ? ' ' + cls : ''}${isFit ? ' is-fit' : ''}`;
  sh.style.zIndex = String(2 * k + 2);
  sh.setAttribute('role', 'dialog');
  sh.setAttribute('aria-modal', 'true');
  sh.tabIndex = -1;
  if (chrome && header == null && title) sh.setAttribute('aria-labelledby', uid + '-t');
  else sh.setAttribute('aria-label', label || stripTags(T(title)) || 'Sheet');
  const head = chrome ? `<div class="sheet-head">${header != null ? `<div class="sheet-hc">${header}</div>` : `<h2 class="sheet-title" id="${uid}-t">${T(title)}</h2>`}${iconButton({icon: 'close', label: 'Close', cls: 'sheet-close', filled: true, attrs: 'data-sheet-close'})}</div>` : '';
  sh.innerHTML = `<div class="sheet-grab" aria-hidden="true"><span></span></div>${head}<div class="sheet-body">${body}</div>`;
  const bodyEl = sh.querySelector('.sheet-body');
  const grabEl = sh.querySelector('.sheet-grab');
  const headEl = sh.querySelector('.sheet-head');

  if (k === 0) setBackgroundInert(true);
  else sheets[k - 1].el.inert = true;
  host.append(scrim, sh);
  hydrate(bodyEl);

  const rec = {el: sh, state: 'open', hid: null, dismiss: null};
  sheets.push(rec);

  // ---- geometry
  const G = {H: 0, large: 0, medium: 0, kb: 0, sheetH: 0};
  const measure = () => {
    const vv = window.visualViewport;
    const layoutH = host.clientHeight || innerHeight;
    const vh = vv ? Math.min(vv.height, layoutH) : layoutH;
    const vTop = vv ? Math.max(0, vv.offsetTop) : 0;
    G.kb = Math.max(0, Math.round(layoutH - (vTop + vh)));
    G.large = Math.max(160, Math.round(vh - safeTop() - 10));
    G.medium = Math.min(G.large, Math.round(vh * .55));
    sh.style.setProperty('--sheet-h', G.large + 'px');
    sh.style.bottom = G.kb + 'px';
    G.sheetH = isFit ? Math.min(sh.offsetHeight || G.large, G.large) : G.large;
  };
  const yOf = d => {
    if (d === 'large' || d === 'fit') return 0;
    if (d === 'medium') return Math.max(0, G.sheetH - G.medium);
    if (typeof d === 'number') return Math.max(0, G.sheetH - d);
    return 0;
  };
  const dets = () => detents.map(d => ({d, y: yOf(d)})).sort((a, b) => a.y - b.y);
  const minY = () => dets()[0].y;
  const maxY = () => dets()[dets().length - 1].y;
  let y = 0;
  const scrimFor = v => .5 * Math.min(1, Math.max(0, (G.sheetH - v) / Math.max(1, G.sheetH - maxY())));
  const setY = v => { y = v; sh.style.transform = `translateY(${v}px)`; scrim.style.opacity = scrimFor(v).toFixed(3); };

  let anims = [];
  const stopAnim = () => {
    if (!anims.length) return;
    try { const m = new DOMMatrixReadOnly(getComputedStyle(sh).transform); y = m.m42; } catch (_) {}
    anims.forEach(a => a.cancel());
    anims = [];
    setY(y);
  };
  const moveTo = (t, v = 0, {spring: sp = 'smooth', duration, easing} = {}) => {
    const from = y;
    stopAnim();
    setY(t);
    const dist = t - from;
    if (Math.abs(dist) < .5) return Promise.resolve();
    const v0 = dist ? (v * 1000) / dist : 0;
    const opt = duration ? {duration, easing} : {spring: sp, v0};
    anims = [
      animate(sh, [{transform: `translateY(${from}px)`}, {transform: `translateY(${t}px)`}], opt),
      animate(scrim, [{opacity: scrimFor(from)}, {opacity: scrimFor(t)}], opt)
    ];
    const mine = anims;
    return Promise.all(mine.map(a => a.finished.catch(() => {}))).then(() => { if (anims === mine) anims = []; });
  };

  // ---- present
  measure();
  const y0 = yOf(cur);
  if (RM) {
    setY(y0);
    animate(sh, [{opacity: 0}, {opacity: 1}], {duration: 200});
    animate(scrim, [{opacity: 0}, {opacity: scrimFor(y0)}], {duration: 200});
  } else {
    y = G.sheetH + 24;
    moveTo(y0);
  }

  // ---- focus
  let focusEl = null;
  if (focus) focusEl = typeof focus === 'string' ? sh.querySelector(focus) : focus;
  try { (focusEl || sh).focus({preventScroll: true}); } catch (_) { (focusEl || sh).focus(); }

  // ---- closing
  let closedFired = false;
  const fireClose = () => { if (closedFired) return; closedFired = true; try { onClose && onClose(); } catch (e) { console.error(e); } };
  const cleanup = () => {
    if (rec.state === 'closed') return;
    rec.state = 'closed';
    stopAnim();
    scrim.remove(); sh.remove();
    const i = sheets.indexOf(rec);
    if (i >= 0) sheets.splice(i, 1);
    if (!sheets.length) setBackgroundInert(false);
    else sheets[sheets.length - 1].el.inert = false;
    if (window.visualViewport) { visualViewport.removeEventListener('resize', onVV); visualViewport.removeEventListener('scroll', onVV); }
    removeEventListener('resize', onVV);
    restoreFocus();
  };
  // Only move focus when it was inside this sheet (or already lost): never steal it from where the user went.
  const restoreFocus = () => {
    const a = document.activeElement;
    if (a && a !== document.body && a !== DOC && !sh.contains(a) && a.isConnected) return;
    let t = typeof returnFocus === 'function' ? (() => { try { return returnFocus(); } catch (_) { return null; } })() : returnFocus;
    if (!canFocus(t)) t = canFocus(trigger) ? trigger : null;
    if (!t && sheets.length) t = sheets[sheets.length - 1].el;
    if (!t) t = visibleScreenEl();
    if (!t) return;
    // After a tap, the returned focus draws no ring (focusVisible: false where supported).
    try { t.focus({preventScroll: true, focusVisible: !byPointer}); } catch (_) { try { t.focus(); } catch (_) {} }
  };
  const animateOut = (v = 0) => {
    const end = G.sheetH + 24;
    if (RM) {
      const a = animate(sh, [{opacity: 1}, {opacity: 0}], {duration: 200, fill: 'forwards'});
      animate(scrim, [{opacity: scrimFor(y)}, {opacity: 0}], {duration: 200, fill: 'forwards'});
      return a.finished.catch(() => {});
    }
    return v > .05 ? moveTo(end, v) : moveTo(end, 0, {duration: 240, easing: 'cubic-bezier(.4,0,1,1)'});
  };
  // Called by app.js when the history entry pops (animated = false when the UI already animated it).
  rec.dismiss = animated => {
    if (rec.state === 'closed') return;
    if (rec.state === 'closing') return;
    rec.state = 'closing';
    fireClose();
    if (animated) guarded(animateOut()).then(cleanup); else cleanup();
  };
  const requestClose = () => {
    if (rec.state !== 'open') return;
    if (HIST && rec.hid != null) HIST.back(rec);
    else rec.dismiss(true);
  };
  const dismissByDrag = v => {
    if (rec.state !== 'open') return;
    rec.state = 'closing';
    fireClose();
    guarded(animateOut(v)).then(cleanup);
    if (HIST && rec.hid != null) HIST.back(rec);
  };
  if (HIST) rec.hid = HIST.pushOverlay(rec);

  // ---- drag physics
  let drag = null;
  const sample = (t, cy) => { drag.s.push([t, cy]); while (drag.s.length > 2 && t - drag.s[0][0] > 100) drag.s.shift(); };
  const velocity = () => {
    const s = drag.s; if (s.length < 2) return 0;
    const a = s[0], b = s[s.length - 1];
    if (performance.now() - b[0] > 100) return 0; // the finger rested before lifting: no fling
    const dt = b[0] - a[0];
    return dt > 0 ? (b[1] - a[1]) / dt : 0;
  };
  const dStart = (cx, cy, fromBody) => {
    if (rec.state !== 'open') return;
    drag = {sx: cx, sy: cy, y0: y, s: [[performance.now(), cy]], locked: false, active: false, fromBody};
  };
  const dMove = (cx, cy, ev) => {
    if (!drag) return;
    const dy = cy - drag.sy, dx = cx - drag.sx;
    if (!drag.locked) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      drag.locked = true;
      const vertical = Math.abs(dy) > Math.abs(dx);
      const atTop = bodyEl.scrollTop <= 0;
      const ok = vertical && (!drag.fromBody || (atTop && (dy > 0 || y > minY() + 1)));
      if (!ok) { drag = null; return; }
      stopAnim();
      drag.active = true;
      drag.sy = cy; drag.y0 = y;
      sh.classList.add('is-dragging');
    }
    if (!drag.active) return;
    if (ev && ev.cancelable) ev.preventDefault();
    let ny = drag.y0 + (cy - drag.sy);
    const top = minY();
    if (ny < top) { const d = top - ny; ny = top - 120 * (1 - 1 / (d / 120 + 1)); }
    setY(ny);
    sample(performance.now(), cy);
  };
  const dEnd = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    sh.classList.remove('is-dragging');
    if (!d.active) return;
    drag = d; const v = velocity(); drag = null;
    const low = maxY();
    const visH = G.sheetH - low;
    if (v > .6 || y > low + .3 * visH) { dismissByDrag(Math.max(v, 0)); return; }
    const proj = y + v * 150;
    let best = dets()[0];
    dets().forEach(x => { if (Math.abs(x.y - proj) < Math.abs(best.y - proj)) best = x; });
    if (best.d !== cur) haptic('selection');
    cur = best.d;
    moveTo(best.y, v);
  };
  // Grabber + header: pointer events (touch-action:none), any direction.
  [grabEl, headEl].forEach(h => {
    if (!h) return;
    h.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dStart(e.clientX, e.clientY, false);
    });
    h.addEventListener('pointermove', e => {
      const wasActive = drag && drag.active;
      dMove(e.clientX, e.clientY, e);
      // Capture only once the drag has locked, so taps on the close button still click.
      if (!wasActive && drag && drag.active) { try { h.setPointerCapture(e.pointerId); } catch (_) {} }
    });
    h.addEventListener('pointerup', dEnd);
    h.addEventListener('pointercancel', dEnd);
    h.addEventListener('lostpointercapture', dEnd);
  });
  // Content: touch events; drags only from the top (down, or up while below the top detent), after the axis lock.
  bodyEl.addEventListener('touchstart', e => { if (e.touches.length === 1) dStart(e.touches[0].clientX, e.touches[0].clientY, true); }, {passive: true});
  bodyEl.addEventListener('touchmove', e => { if (drag && drag.fromBody && e.touches.length === 1) dMove(e.touches[0].clientX, e.touches[0].clientY, e); }, {passive: false});
  bodyEl.addEventListener('touchend', () => { if (drag && drag.fromBody) dEnd(); }, {passive: true});
  bodyEl.addEventListener('touchcancel', () => { if (drag && drag.fromBody) dEnd(); }, {passive: true});

  // ---- interactions
  scrim.addEventListener('click', requestClose);
  sh.addEventListener('click', e => { if (e.target.closest('[data-sheet-close]')) requestClose(); });
  // Keyboard focus that lands below the screen edge (the sheet is translated at a lower detent, so focusing never
  // scrolls it into view): rise to the next detent that shows it, or the top one.
  sh.addEventListener('focusin', e => {
    const t = e.target;
    if (rec.state !== 'open' || drag || !t || t === sh || !bodyEl.contains(t)) return;
    const d = dets();
    if (y <= d[0].y + 1) return;
    // Both rects move with the transform, so their difference is the offset inside the sheet; G.sheetH - y shows.
    const over = (t.getBoundingClientRect().bottom - sh.getBoundingClientRect().top) - (G.sheetH - y) + 16;
    if (over <= 0) return;
    const up = d.filter(x => x.y < y - 1);
    const best = up.slice().reverse().find(x => x.y <= y - over) || d[0];
    cur = best.d;
    moveTo(best.y);
  });
  sh.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); requestClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...sh.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sh)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // ---- keyboard / visual viewport
  const onVV = () => {
    if (rec.state !== 'open') return;
    measure();
    if (!drag) { stopAnim(); setY(yOf(cur)); }
  };
  if (window.visualViewport) { visualViewport.addEventListener('resize', onVV); visualViewport.addEventListener('scroll', onVV); }
  addEventListener('resize', onVV);
  rec.requestClose = requestClose;

  return {
    el: sh,
    body: bodyEl,
    close: requestClose,
    setDetent(d) { if (rec.state !== 'open') return; cur = d; if (isFit) measure(); moveTo(yOf(d)); },
    get detent() { return cur; },
    get open() { return rec.state === 'open'; }
  };
}

/** Confirm / action sheet. actions: [{label, value, role: 'destructive'|'cancel', checked}]. Resolves value or null.
 *  cls: an extra scope class (e.g. 'sh-sort') next to .sh-action; returnFocus: see openSheet. */
export function actionSheet({title, message, actions = [], cancelLabel = 'Cancel', cls = '', returnFocus} = {}) {
  return new Promise(res => {
    let chosen = null;
    const main = actions.filter(a => a.role !== 'cancel');
    const cancel = actions.find(a => a.role === 'cancel') || {label: cancelLabel, value: null};
    const head = (title || message) ? `<div class="as-head">${title ? `<p class="as-title">${T(title)}</p>` : ''}${message ? `<p class="as-msg">${T(message)}</p>` : ''}</div>` : '';
    const body = `<div class="as-group">${head}${main.map((a, i) => `<button type="button" class="as-btn${a.role === 'destructive' ? ' is-destructive' : ''}" data-as="${i}"${a.checked ? ' aria-current="true"' : ''}>${T(a.label)}${a.checked ? icon('check') : ''}</button>`).join('')}</div><div class="as-group"><button type="button" class="as-btn is-cancel" data-as="c">${T(cancel.label)}</button></div>`;
    const s = openSheet({cls: 'sh-action' + (cls ? ' ' + cls : ''), detents: ['fit'], chrome: false, body, label: stripTags(T(title)) || 'Choose', returnFocus, onClose: () => res(chosen)});
    s.body.addEventListener('click', e => {
      const b = e.target.closest('[data-as]');
      if (!b) return;
      chosen = b.dataset.as === 'c' ? (cancel.value == null ? null : cancel.value) : main[+b.dataset.as].value;
      haptic('light');
      s.close();
    });
  });
}

/** Manager picker: 4x3 grid of 56px avatars. Resolves an id, 'none' (allowNone), or null when dismissed. */
export function pickManager({title = 'Pick a manager', selected, disabled = [], note, allowNone, returnFocus} = {}) {
  return new Promise(res => {
    let chosen = null;
    const dis = new Set([].concat(disabled || []).filter(Boolean));
    const cells = ids.map(id => `<button type="button" class="pm-cell" data-pick="${esc(id)}" aria-pressed="${id === selected}"${dis.has(id) ? ' disabled' : ''}>${avatar(id, {size: 56, you: id === selected})}<span>${esc(name(id))}</span></button>`).join('');
    const none = allowNone ? `<div class="pm-none">${button({label: 'Not in the league', kind: 'secondary', attrs: {'data-pick': 'none', 'aria-pressed': String(selected === 'none')}})}</div>` : '';
    const body = `<div class="pm-grid">${cells}</div>${none}${note ? `<p class="pm-note">${T(note)}</p>` : ''}`;
    const s = openSheet({title, body, cls: 'sh-manager', detents: ['fit'], returnFocus, onClose: () => res(chosen)});
    s.body.addEventListener('click', e => {
      const b = e.target.closest('[data-pick]');
      if (!b || b.disabled) return;
      chosen = b.dataset.pick;
      haptic('light');
      s.close();
    });
  });
}

// ============================================================================ Hydration
/** Wire declarative behaviors inside freshly rendered HTML: count-ups ([data-count-to]) and search field state.
 *  app.js calls it after every render; call it yourself after patching innerHTML. */
export function hydrate(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-count-to]:not([data-hyd])').forEach(el => {
    el.setAttribute('data-hyd', '');
    countUp(el, +el.dataset.countTo, {from: +(el.dataset.countFrom || 0), key: el.dataset.countKey || null, format: el.dataset.countFmt, duration: +(el.dataset.countDur || 700)});
  });
  root.querySelectorAll('.search input').forEach(inp => inp.parentElement.classList.toggle('is-filled', !!inp.value));
}

// ============================================================================ Behaviors (document-level, installed once)
function emitChange(el, nm, value) {
  el.dispatchEvent(new CustomEvent('ui:change', {bubbles: true, detail: {name: nm, value}}));
}
/** Select a segment by value. animate: slide the thumb (snappy). emit: dispatch ui:change. */
export function setSeg(segEl, value, {animate: an = true, emit = false} = {}) {
  if (!segEl) return;
  const btns = [...segEl.querySelectorAll(':scope > button[role="tab"]')];
  const i1 = btns.findIndex(b => b.dataset.value === String(value));
  if (i1 < 0) return;
  const i0 = btns.findIndex(b => b.getAttribute('aria-selected') === 'true');
  btns.forEach((b, i) => { b.setAttribute('aria-selected', String(i === i1)); b.tabIndex = i === i1 ? 0 : -1; });
  segEl.style.setProperty('--i', i1);
  const th = segEl.querySelector(':scope > .seg-thumb');
  if (an && th && i0 >= 0 && i0 !== i1) animate(th, [{transform: `translateX(${i0 * 100}%)`}, {transform: `translateX(${i1 * 100}%)`}], {spring: 'snappy'});
  if (emit && i0 !== i1) emitChange(segEl, segEl.dataset.seg, btns[i1].dataset.value);
}
/** Select a chip by value (single select); scrolls it into view. */
export function setChips(chipsEl, value, {emit = false, scroll = true} = {}) {
  if (!chipsEl) return;
  let hit = null, changed = false;
  chipsEl.querySelectorAll(':scope > .chip').forEach(c => {
    const on = c.dataset.value === String(value);
    if (on) hit = c;
    if ((c.getAttribute('aria-pressed') === 'true') !== on) changed = true;
    c.setAttribute('aria-pressed', String(on));
  });
  if (hit && scroll) {
    const r = hit.getBoundingClientRect(), p = chipsEl.getBoundingClientRect();
    if (r.left < p.left + 16 || r.right > p.right - 24) {
      chipsEl.scrollTo({left: chipsEl.scrollLeft + (r.left - p.left) - (p.width - r.width) / 2, behavior: RM ? 'auto' : 'smooth'});
    }
  }
  if (emit && changed && hit) emitChange(chipsEl, chipsEl.dataset.chips, hit.dataset.value);
}

let pressEl = null, pressX = 0, pressY = 0, pressT = 0, pressOn = false, pressDelay = 0;
let lastPress = null; // {el, at}: the control tapped last (a sheet opened from it returns focus there; iOS never focuses it)
let lastKeyAt = -1;
const PRESSABLE = 'button, a[href], [data-press], [role="button"], summary';
// Touch inside something that scrolls (a screen, a sheet body, a horizontal rail) delays the highlight by 90 ms, like
// iOS scroll views (delaysContentTouches): a scroll that starts on a row or card never lights it up. Bars, segmented
// controls, chips, switches, icon buttons and the puzzle run keep the instant press (nothing scrolls under them).
const PRESS_DELAY = 90;
const SCROLLS = '.screen, .sheet-body, [data-hscroll]';
const INSTANT = '#tabbar, .nav, .bar, .sheet-head, .seg, .chip, .switch, .icon-btn, .search-clear, .v-run, .as-group';
const pressOff = el => {
  clearTimeout(el._prT);
  el._prT = 0;
  el.classList.remove('is-pressed');
};
// Each element keeps its own release timer, so a quick second tap elsewhere never cancels the first one's release.
const pressOffLater = (el, ms) => { clearTimeout(el._prT); el._prT = setTimeout(() => pressOff(el), ms); };
function pressDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const t = e.target && e.target.closest ? e.target.closest(PRESSABLE) : null;
  releasePress(true);
  if (t && !t.disabled) lastPress = {el: t, at: performance.now()};
  if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true' || t.dataset.press === 'off') return;
  pressEl = t; pressX = e.clientX; pressY = e.clientY; pressT = performance.now();
  clearTimeout(t._prT);
  if (e.pointerType === 'touch' && t.closest(SCROLLS) && !t.closest(INSTANT)) {
    pressOn = false;
    pressDelay = setTimeout(() => {
      if (pressEl !== t) return;
      pressOn = true; pressT = performance.now();
      t.classList.add('is-pressed');
    }, PRESS_DELAY);
  } else {
    pressOn = true;
    t.classList.add('is-pressed');
  }
}
function pressMove(e) {
  if (!pressEl) return;
  if (Math.abs(e.clientX - pressX) > 10 || Math.abs(e.clientY - pressY) > 10) releasePress(true);
}
function releasePress(now) {
  const el = pressEl;
  if (!el) return;
  pressEl = null;
  clearTimeout(pressDelay);
  if (!pressOn) {
    // Moved, scrolled or cancelled before the delayed highlight showed: nothing was pressed.
    if (now === true) return;
    // A quick tap that ended before the delay: show the feedback now, briefly.
    el.classList.add('is-pressed');
    pressOffLater(el, PRESS_DELAY);
    return;
  }
  const held = performance.now() - pressT;
  if (now === true || held >= 70) pressOff(el);
  else pressOffLater(el, 70 - held);
}

function onClick(e) {
  const t = e.target;
  if (!t || !t.closest) return;
  const sb = t.closest('.seg > button[role="tab"]');
  if (sb) {
    const s = sb.parentElement;
    if (sb.getAttribute('aria-selected') !== 'true') { haptic('selection'); setSeg(s, sb.dataset.value, {animate: true, emit: true}); }
    return;
  }
  const ch = t.closest('[data-chips] > .chip');
  if (ch) {
    if (ch.getAttribute('aria-pressed') !== 'true') { haptic('selection'); setChips(ch.parentElement, ch.dataset.value, {emit: true}); }
    return;
  }
  const sw = t.closest('.switch[role="switch"]');
  if (sw && !sw.disabled) {
    const v = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(v));
    haptic('selection');
    emitChange(sw, sw.dataset.switch, v);
    return;
  }
  const clr = t.closest('.search-clear');
  if (clr) {
    const inp = clr.parentElement.querySelector('input');
    if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', {bubbles: true})); inp.focus(); }
  }
}
function onKey(e) {
  lastKeyAt = performance.now();
  if (e.key === 'Escape' && !e.defaultPrevented) {
    const top = [...sheets].reverse().find(s => s.state === 'open');
    if (top) { e.preventDefault(); e.stopImmediatePropagation(); top.requestClose(); return; }
  }
  const sb = e.target && e.target.closest && e.target.closest('.seg > button[role="tab"]');
  if (sb && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End')) {
    const btns = [...sb.parentElement.querySelectorAll(':scope > button[role="tab"]')];
    let i = btns.indexOf(sb);
    i = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
    e.preventDefault();
    btns[i].focus();
    if (btns[i].getAttribute('aria-selected') !== 'true') setSeg(sb.parentElement, btns[i].dataset.value, {emit: true});
  }
}
function onInput(e) {
  const inp = e.target;
  if (inp && inp.closest && inp.parentElement && inp.parentElement.classList.contains('search')) inp.parentElement.classList.toggle('is-filled', !!inp.value);
}

let installed = false;
/** Installs the document-level behaviors (runs on import; safe to call again). */
export function install() {
  if (installed) return;
  installed = true;
  DOC.classList.toggle('rm', RM);
  const cap = {capture: true, passive: true};
  document.addEventListener('pointerdown', pressDown, cap);
  document.addEventListener('pointermove', pressMove, cap);
  document.addEventListener('pointerup', () => releasePress(false), cap);
  document.addEventListener('pointercancel', () => releasePress(true), cap);
  document.addEventListener('dragstart', () => releasePress(true), true);
  addEventListener('blur', () => releasePress(true));
  document.addEventListener('scroll', () => { lastScroll = performance.now(); if (pressEl) releasePress(true); }, cap);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('input', onInput, true);
}
install();
