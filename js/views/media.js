// The Media Room (#/puzzles/media, pushed over Daily Games from its case on the Home shelf; Nov 24 2026, Evan: "Create a
// new disc on the Home Screen for the media room. This should include all the videos in the app from the happy meal
// challenge to the weekly press conferences. Make this look like a Netflix or HBO app. You can leave the press
// conference videos in the matchup tab, but get rid of the media archive section since this will be replacing it").
// Everyone. A dark streaming app of the league's videos:
//   a bar (Back, the MEDIA ROOM wordmark) over All · Press Conferences · Happy Meals (remembered: gg-media-filter);
//   the billboard (the newest press conference, or the 1st pick's Happy Meal) with Play / Resume and Info;
//   All: Continue Watching (where this profile left off on this phone: core/media.js), Press Conferences (newest first,
//   Corbin's week 7 no-show among them), The Happy Meal Challenge (big pick numbers, in the 2026 draft order) and
//   the 2026 Draft Order card (every time with its penalties and credits); Press Conferences and Happy Meals list
//   every episode instead.
// A poster opens its title page (a sheet): the player on top (the app's own: play/pause, 10 s back and on, the slider,
// time, full screen; YouTube's player for a presser that only has a YouTube link), the title, Play / Resume / Start over,
// what happened, who's in it, the press's questions for a press conference, the times for a Happy Meal, and More
// episodes (a tap plays it). Closing the sheet, leaving or hiding the screen stops the video and keeps its place.
// Sources: core/press.js (the pressers, seed merged under Firestore; no-shows; questions) and core/media.js
// (data/media.json). Owner: MEDIA.
import * as ui from '../core/ui.js';
import * as data from '../core/data.js';
import * as press from '../core/press.js';
import * as media from '../core/media.js';

const esc = data.esc;
const nm = id => data.name(id);
const names = ids => ids.map(nm).join(' & ');
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[n % 10] || 'th'));
const clock = t => { const s = Math.max(0, Math.floor(t || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const FILTERS = [{id: 'all', label: 'All'}, {id: 'press', label: 'Press Conferences'}, {id: 'meals', label: 'Happy Meals'}];
const FILTER_KEY = 'gg-media-filter';
const filterNow = () => { const f = ui.lsGet(FILTER_KEY); return FILTERS.some(x => x.id === f) ? f : 'all'; };
const ST = new Map(); // ctx -> state

// ============================================================================ The catalogue
// "lost 98.20–120.40 to Mason" (or beat / tied), '' before the week's scores are in.
function gameLine(c) {
  if (!c || !data.M[c.opp] || !isFinite(+c.sa) || !isFinite(+c.sb)) return '';
  const s = `${data.fmt(c.sa)}–${data.fmt(c.sb)}`;
  return c.tie ? `tied ${nm(c.opp)} ${s}` : c.lost ? `lost ${s} to ${nm(c.opp)}` : `beat ${nm(c.opp)} ${s}`;
}
const cap1 = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
function pressItem(p) {
  const g = gameLine(p.ctx), who = nm(p.who);
  return {id: 'press:' + p.key, kind: 'press', key: p.key, who: [p.who], src: p, tall: !!p.tall, poster: press.thumbOf(p),
    file: press.FILE_RE.test(p.file || '') ? p.file : null, year: p.year, week: p.week,
    title: p.title || `${who} Faces the Media`, short: who, badge: `WK ${p.week}`,
    eyebrow: 'Press Conference', meta: [String(p.year), `Week ${p.week}`].join(' · '),
    line: g ? cap1(g) : `Week ${p.week}`,
    about: g ? `${who} ${g} in the week ${p.week} Matchup of the Week, then faced the media.` : `${who} faces the media after week ${p.week}.`};
}
function mealItem(m, draft) {
  const T = new Map((draft ? draft.times : []).map(t => [t.who, t]));
  const ts = m.who.map(id => T.get(id)).filter(Boolean);
  const pick = ts.length ? Math.min(...ts.map(t => t.pick)) : 99;
  const line = !ts.length ? '' : ts.length === 1 ? `${ord(ts[0].pick)} pick · ${ts[0].time}` : `Picks ${ts.map(t => t.pick).join(' & ')} · ${ts.map(t => t.time).join(' & ')}`;
  const adjTxt = a => `${a[0] > 0 ? 'a ' + a[0] + ' s penalty' : 'a ' + Math.abs(a[0]) + ' s credit'} (${a[1]})`;
  const about = ts.length ? ts.map(t => `${nm(t.who)} finished in ${t.raw}${t.adj.length ? ` with ${t.adj.map(adjTxt).join(' and ')}` : ''}: ${t.time}, the ${ord(t.pick)} pick${draft && draft.year ? ` of the ${draft.year} draft` : ''}.`).join(' ')
    : `${names(m.who)} takes on the Happy Meal Challenge.`;
  return {id: 'meal:' + m.key, kind: 'meal', key: m.key, who: m.who, src: m, tall: !!m.tall, poster: press.thumbOf(m), file: m.file,
    pick, picks: ts, title: `${names(m.who)}'s Happy Meal`, short: names(m.who), badge: pick < 99 ? `#${pick}` : '',
    eyebrow: 'The Happy Meal Challenge', meta: [draft && draft.year ? String(draft.year) : '', line].filter(Boolean).join(' · '), line, about};
}
function catalogue(s) {
  const pressers = (s.list || []).filter(p => p && p.key && press.playable(p)).map(pressItem);
  const meals = (s.meals || []).map(m => mealItem(m, s.draft)).sort((a, b) => a.pick - b.pick || a.short.localeCompare(b.short));
  const all = [...pressers, ...meals], byId = new Map(all.map(x => [x.id, x]));
  const shows = s.list ? safe(() => press.noShows(new Set(s.list.map(p => p.key)))) : [];
  return {pressers, meals, all, byId, shows};
}
const safe = f => { try { return f() || []; } catch (e) { console.error(e); return []; } };

// ============================================================================ Markup
// (under every poster, the mic on dark: what shows while it loads, or if it can't)
const posterImg = (x, cls = '') => `<span class="mr-ph" aria-hidden="true">${ui.icon('mic')}</span><img class="mr-img${cls ? ' ' + cls : ''}" src="${esc(x.poster)}" alt="" loading="lazy" decoding="async" draggable="false">`;
// A poster that can't load (a YouTube thumbnail offline) steps aside for the mic.
try { document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.closest && t.closest('.mr, .mr-sheet')) t.classList.add('is-broken'); }, true); } catch (_) {}
const progHTML = x => { const p = media.share(x.id); return p > 0 && p < 1 ? `<span class="mr-prog" aria-hidden="true"><i style="width:${(p * 100).toFixed(1)}%"></i></span>` : ''; };
function barHTML(filter) {
  return `<header class="mr-bar" data-mr-bar>`
    + `<div class="mr-bar-top"><button type="button" class="mr-back" data-back aria-label="Back">${ui.icon('chevron-left')}</button>`
    + `<span class="mr-logo" role="heading" aria-level="1">MEDIA <b>ROOM</b></span><span class="mr-bar-end" aria-hidden="true"></span></div>`
    + `<div class="mr-chips" role="tablist" aria-label="Show">${FILTERS.map(f => `<button type="button" role="tab" class="mr-chip" data-mr-filter="${f.id}" aria-selected="${f.id === filter}">${esc(f.label)}</button>`).join('')}</div>`
    + `</header>`;
}
function heroHTML(x) {
  if (!x) return `<section class="mr-hero is-empty" aria-busy="true"><div class="mr-hero-card"><span class="mr-hero-sk"></span></div></section>`;
  const at = media.resumeAt(x.id);
  return `<section class="mr-hero" aria-label="${esc('Featured: ' + x.title)}">`
    + `<span class="mr-hero-bg" aria-hidden="true"><img src="${esc(x.poster)}" alt="" decoding="async"></span>`
    + `<div class="mr-hero-card">${posterImg(x, 'mr-hero-img')}<span class="mr-hero-shade" aria-hidden="true"></span>`
    + `<div class="mr-hero-in"><p class="mr-eyebrow"><i class="mr-g" aria-hidden="true">G</i>${esc(x.eyebrow)}</p>`
    + `<h2 class="mr-hero-t">${esc(x.title)}</h2><p class="mr-hero-m">${esc([x.kind === 'press' ? `Week ${x.week}` : '', x.line].filter(Boolean).join(' · '))}</p>`
    + `<div class="mr-hero-b"><button type="button" class="mr-btn is-play" data-mr-play="${esc(x.id)}">${ui.icon('play-fill')}<span>${at ? 'Resume' : 'Play'}</span></button>`
    + `<button type="button" class="mr-btn is-info" data-mr-open="${esc(x.id)}">${ui.icon('info')}<span>Info</span></button></div>`
    + `${progHTML(x)}</div></div></section>`;
}
function cardHTML(x, {wide = true, sub} = {}) {
  const s = sub != null ? sub : x.line;
  return `<button type="button" class="mr-card${wide ? ' is-wide' : ''}" data-mr-open="${esc(x.id)}" data-mr-id="${esc(x.id)}" aria-label="${esc(`${x.title}${s ? '. ' + s : ''}`)}">`
    + `<span class="mr-art${x.tall ? ' is-tall-src' : ''}">${posterImg(x)}${x.badge && wide ? `<span class="mr-badge" aria-hidden="true">${esc(x.badge)}</span>` : ''}<span class="mr-glyph" aria-hidden="true">${ui.icon('play-fill')}</span>${progHTML(x)}</span>`
    + `<span class="mr-card-t" aria-hidden="true">${esc(x.short)}</span>${s ? `<span class="mr-card-s" aria-hidden="true">${esc(s)}</span>` : ''}</button>`;
}
function noShowHTML(n) {
  return `<div class="mr-card is-wide is-noshow" role="listitem" aria-label="${esc(`Week ${n.week}: ${nm(n.who)} did not attend`)}">`
    + `<span class="mr-art" aria-hidden="true"><span class="mr-ns">${ui.icon('mic')}<b>NO SHOW</b></span><span class="mr-badge">WK ${n.week}</span></span>`
    + `<span class="mr-card-t" aria-hidden="true">${esc(nm(n.who))}</span><span class="mr-card-s" aria-hidden="true">Did not attend</span></div>`;
}
function topHTML(x) {
  const n = x.pick < 99 ? x.pick : '';
  return `<button type="button" class="mr-top" data-mr-open="${esc(x.id)}" data-mr-id="${esc(x.id)}" aria-label="${esc(`${x.title}. ${x.line}`)}">`
    + `<span class="mr-top-n${String(n).length > 1 ? ' is-2' : ''}" aria-hidden="true">${n}</span>`
    + `<span class="mr-art is-poster">${posterImg(x)}<span class="mr-top-l" aria-hidden="true"><b>${esc(x.short)}</b><small>${esc(x.picks.map(t => t.time).join(' & '))}</small></span>${progHTML(x)}</span></button>`;
}
const rowHTML = (title, inner, {cls = '', sub = ''} = {}) => `<section class="mr-row${cls ? ' ' + cls : ''}"><h2 class="mr-row-h">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</h2>`
  + `<div class="mr-rail" data-hscroll role="list">${inner}</div></section>`;
function epHTML(x, i) {
  const w = media.watched(x.id), at = media.resumeAt(x.id);
  const left = at && w ? `${Math.max(1, Math.round((w.d - at) / 60))} min left` : w && w.done ? 'Watched' : '';
  return `<button type="button" class="mr-ep" data-mr-open="${esc(x.id)}" data-mr-id="${esc(x.id)}" aria-label="${esc(`${x.title}. ${x.line}${left ? '. ' + left : ''}`)}">`
    + `<span class="mr-art${x.tall ? ' is-tall-src' : ''}">${posterImg(x)}<span class="mr-glyph" aria-hidden="true">${ui.icon('play-fill')}</span>${progHTML(x)}</span>`
    + `<span class="mr-ep-tx" aria-hidden="true"><b>${esc(i != null ? `${i}. ${x.title}` : x.title)}</b><small>${esc([x.kind === 'press' ? `Week ${x.week}` : x.line, left].filter(Boolean).join(' · '))}</small><span>${esc(x.about)}</span></span></button>`;
}
const epNoShow = n => `<div class="mr-ep is-noshow" role="listitem"><span class="mr-art" aria-hidden="true"><span class="mr-ns">${ui.icon('mic')}<b>NO SHOW</b></span></span>`
  + `<span class="mr-ep-tx"><b>${esc(`${nm(n.who)} didn't show`)}</b><small>Week ${n.week}</small><span>${esc(`${nm(n.who)} ${gameLine(n.ctx) || 'lost the Matchup of the Week'} and never faced the media.`)}</span></span></div>`;
function draftHTML(draft) {
  if (!draft) return '';
  const me = data.me();
  const adjTxt = a => `${a[0] > 0 ? '+' : '−'}${Math.abs(a[0])} s ${a[1]}`;
  const rows = draft.times.map(t => {
    const how = t.adj.length ? `${t.raw} ${t.adj.map(adjTxt).join(', ')}` : t.note || '';
    return `<li class="mr-dr${t.who === me ? ' is-me' : ''}${t.pick === 1 ? ' is-first' : ''}"><span class="mr-dr-pk" aria-label="${esc(ord(t.pick) + ' pick')}">${t.pick}</span>`
      + ui.avatar(t.who, {size: 32, you: t.who === me})
      + `<span class="mr-dr-m"><b>${esc(nm(t.who))}</b>${how ? `<small>${esc(how)}</small>` : ''}</span><span class="mr-dr-t">${esc(t.time)}</span></li>`;
  }).join('');
  return `<section class="mr-row mr-draft" aria-labelledby="mr-draft-h"><h2 class="mr-row-h" id="mr-draft-h">${esc(`${draft.year || ''} Draft Order`.trim())}<small>Fastest Happy Meal picks first</small></h2><ol class="mr-dr-list">${rows}</ol></section>`;
}
function mainHTML(s) {
  const C = catalogue(s), f = s.filter;
  const loadingP = !s.list, loadingM = !s.meals;
  const skRail = (n, cls) => `<div class="mr-rail" aria-hidden="true">${Array.from({length: n}, () => `<span class="mr-sk ${cls}"></span>`).join('')}</div>`;
  const hero = f === 'meals' ? C.meals[0] : C.pressers[0] || C.meals[0];
  let out = heroHTML(hero);
  if (f === 'all') {
    const cont = media.continuing(C.all.map(x => x.id)).map(id => C.byId.get(id)).filter(Boolean);
    if (cont.length) out += rowHTML('Continue Watching', cont.map(x => { const w = media.watched(x.id); return cardHTML(x, {sub: w ? `${Math.max(1, Math.round((w.d - w.t) / 60))} min left` : x.line}); }).join(''), {cls: 'is-cont'});
    const pr = C.pressers.map(x => ({x, k: x.year * 100 + x.week})).concat(C.shows.map(n => ({n, k: n.year * 100 + n.week}))).sort((a, b) => b.k - a.k);
    out += loadingP ? `<section class="mr-row"><h2 class="mr-row-h">Press Conferences</h2>${skRail(3, 'is-wide')}</section>`
      : pr.length ? rowHTML('Press Conferences', pr.map(r => (r.x ? cardHTML(r.x) : noShowHTML(r.n))).join(''), {sub: 'The Matchup of the Week loser faces the media'}) : '';
    out += loadingM ? `<section class="mr-row"><h2 class="mr-row-h">The Happy Meal Challenge</h2>${skRail(3, 'is-poster')}</section>`
      : C.meals.length ? rowHTML('The Happy Meal Challenge', C.meals.map(topHTML).join(''), {cls: 'is-top', sub: s.draft ? `The race that set the ${s.draft.year || ''} draft order`.replace('  ', ' ') : ''}) : '';
    if (!loadingP && C.pressers.filter(x => x.year === C.pressers[0].year).length > 2) {
      const tall = C.pressers.filter(x => x.year === C.pressers[0].year).sort((a, b) => a.week - b.week);
      out += rowHTML(`The ${tall[0].year} Season, Week by Week`, tall.map(x => cardHTML(x, {wide: false, sub: `Week ${x.week}`})).join(''), {cls: 'is-posters'});
    }
    out += draftHTML(s.draft);
  } else if (f === 'press') {
    const eps = C.pressers.map(x => ({x, k: x.year * 100 + x.week})).concat(C.shows.map(n => ({n, k: n.year * 100 + n.week}))).sort((a, b) => b.k - a.k);
    const years = [...new Set(eps.map(e => Math.floor(e.k / 100)))];
    out += loadingP ? `<div class="mr-eps">${'<span class="mr-sk is-ep"></span>'.repeat(4)}</div>`
      : !eps.length ? `<p class="mr-none">No press conferences yet.</p>`
      : years.map(y => `<section class="mr-row"><h2 class="mr-row-h">${y} Season<small>${eps.filter(e => Math.floor(e.k / 100) === y && e.x).length} episodes</small></h2><div class="mr-eps" role="list">`
        + eps.filter(e => Math.floor(e.k / 100) === y).map(e => (e.x ? epHTML(e.x) : epNoShow(e.n))).join('') + `</div></section>`).join('');
  } else {
    out += loadingM ? `<div class="mr-eps">${'<span class="mr-sk is-ep"></span>'.repeat(4)}</div>`
      : `${draftHTML(s.draft)}<section class="mr-row"><h2 class="mr-row-h">Every Happy Meal<small>In draft order</small></h2><div class="mr-eps" role="list">${C.meals.map(x => epHTML(x, x.pick < 99 ? x.pick : null)).join('')}</div></section>`;
  }
  if (s.err && !C.all.length) out += `<p class="mr-none">The videos couldn't load. Check your connection and try again.</p>`;
  return out;
}

// ============================================================================ The title page and its player
function playerHTML(x) {
  const bg = x.tall ? `<span class="mr-pl-bg" aria-hidden="true"><img src="${esc(x.poster)}" alt=""></span>` : '';
  return `<div class="mr-pl${x.tall ? ' is-tall' : ''}" data-mr-pl>${bg}<div class="mr-vp" data-mr-vp>`
    + `<img class="mr-vp-poster" src="${esc(x.poster)}" alt="" decoding="async">`
    + `<button type="button" class="mr-vp-go" data-mr-go aria-label="${esc('Play ' + x.title)}">${ui.icon('play-fill')}</button></div>`
    + `<button type="button" class="mr-x" data-sheet-close aria-label="Close">${ui.icon('close')}</button></div>`;
}
function detailHTML(s, x) {
  const C = catalogue(s);
  const at = media.resumeAt(x.id);
  const who = x.who.map(id => `<span class="mr-who">${ui.avatar(id, {size: 28, you: id === data.me()})}<span>${esc(nm(id))}</span></span>`).join('');
  let extra = '';
  if (x.kind === 'press') {
    const qs = safe(() => press.questionsFor(x.key)).filter(q => q && q.q && data.M[q.by]);
    if (qs.length) extra = `<section class="mr-d-sec"><h3>From the Press</h3><ol class="mr-qs">${qs.map(q => `<li>${ui.avatar(q.by, {size: 28})}<span><b>${esc(nm(q.by))}</b><span>${esc(q.q)}</span>${q.note ? `<small>${esc(q.note)}</small>` : ''}</span></li>`).join('')}</ol></section>`;
  } else if (x.picks.length) {
    const adjTxt = a => `${a[0] > 0 ? '+' : '−'}${Math.abs(a[0])} s ${a[1]}`;
    extra = `<section class="mr-d-sec"><h3>The Times</h3><ul class="mr-times">${x.picks.map(t => `<li><span class="mr-dr-pk">${t.pick}</span><span><b>${esc(nm(t.who))}</b><small>${esc([`${t.raw} on the clock`, ...t.adj.map(adjTxt), t.note].filter(Boolean).join(' · '))}</small></span><span class="mr-dr-t">${esc(t.time)}</span></li>`).join('')}</ul></section>`;
  }
  const more = (x.kind === 'press' ? C.pressers : C.meals).filter(y => y.id !== x.id);
  const moreHTML = more.length ? `<section class="mr-d-sec"><h3>${x.kind === 'press' ? 'More Episodes' : 'More Happy Meals'}</h3><div class="mr-eps">${more.map(y => epHTML(y, x.kind === 'meal' && y.pick < 99 ? y.pick : null).replace('data-mr-open=', 'data-mr-swap=')).join('')}</div></section>` : '';
  return `<div class="mr-d" data-mr-d="${esc(x.id)}">${playerHTML(x)}<div class="mr-d-in">`
    + `<p class="mr-eyebrow"><i class="mr-g" aria-hidden="true">G</i>${esc(x.eyebrow)}</p><h2 class="mr-d-t">${esc(x.title)}</h2>`
    + `<p class="mr-d-meta"><span>${esc(x.meta)}</span><span class="mr-rate">TV-GG</span><span class="mr-hd">HD</span></p>`
    + `<button type="button" class="mr-btn is-play is-block" data-mr-main-play>${ui.icon('play-fill')}<span>${at ? `Resume from ${clock(at)}` : 'Play'}</span></button>`
    + `<p class="mr-d-about">${esc(x.about)}</p><div class="mr-d-who"><span class="mr-d-lbl">Starring</span>${who}</div>`
    + extra + moreHTML + `</div></div>`;
}

// The player in the title page. The app's own for a video in the app (core/press.js FILE_RE), YouTube's (or Drive's)
// for a presser posted as a link. Its place is saved as it plays, on pause and when it stops (core/media.js).
const HIDE_MS = 2600;
function startPlayer(s, x, {from = null} = {}) {
  const host = s.sheet && s.sheet.el.querySelector('[data-mr-vp]');
  if (!host) return;
  stopPlayer(s);
  host.classList.add('is-on');
  const P = {x, host, v: null, hideT: 0, raf: 0, saveAt: 0, dead: false};
  s.player = P;
  if (!x.file) {
    const ifr = document.createElement('iframe');
    ifr.className = 'mr-ifr';
    ifr.title = x.title;
    ifr.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    ifr.setAttribute('allowfullscreen', '');
    ifr.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    ifr.src = press.playerOf(x.src);
    host.append(ifr);
    paintMainBtn(s);
    return;
  }
  const box = document.createElement('div');
  box.className = 'mr-v is-shown';
  box.innerHTML = `<video class="mr-video" playsinline webkit-playsinline preload="auto" poster="${esc(x.poster)}" src="${esc(press.fileURL(x.file))}" aria-label="${esc(x.title)}"></video>`
    + `<div class="mr-v-mid"><button type="button" class="mr-v-skip" data-mr-skip="-10" aria-label="Back 10 seconds"><span>10</span></button>`
    + `<button type="button" class="mr-v-pp" data-mr-pp aria-label="Pause">${ui.icon('pause-fill')}</button>`
    + `<button type="button" class="mr-v-skip is-fwd" data-mr-skip="10" aria-label="Forward 10 seconds"><span>10</span></button></div>`
    + `<div class="mr-v-bot"><input type="range" class="mr-v-seek" min="0" max="1000" step="1" value="0" aria-label="${esc('Position in ' + x.title)}" aria-valuetext="0:00">`
    + `<span class="mr-v-time" aria-hidden="true">0:00</span>`
    + `<button type="button" class="mr-v-fs" data-mr-fs aria-label="Full screen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
  host.append(box);
  const v = box.querySelector('video'), pp = box.querySelector('[data-mr-pp]'), seek = box.querySelector('.mr-v-seek'), time = box.querySelector('.mr-v-time');
  P.v = v; P.box = box;
  let dragging = false;
  const save = force => { const now = performance.now(); if (!force && now - P.saveAt < 2000) return; P.saveAt = now; if (v.duration > 0) media.saveWatch(x.id, v.ended ? v.duration : v.currentTime, v.duration); };
  P.save = save;
  const show = () => {
    box.classList.add('is-shown');
    clearTimeout(P.hideT);
    if (!v.paused && !dragging) P.hideT = setTimeout(() => { if (!v.paused && !dragging) box.classList.remove('is-shown'); }, HIDE_MS);
  };
  const paint = () => {
    const d = v.duration, f = d > 0 && isFinite(d) ? Math.min(1, v.currentTime / d) : 0;
    if (!dragging) seek.value = String(Math.round(f * 1000));
    seek.style.setProperty('--p', `${(dragging ? Number(seek.value) / 10 : f * 100).toFixed(2)}%`);
    const tx = `${clock(v.currentTime)} / ${clock(d)}`;
    if (time.textContent !== tx) time.textContent = d > 0 && isFinite(d) ? tx : clock(v.currentTime);
    seek.setAttribute('aria-valuetext', `${clock(v.currentTime)} of ${clock(d)}`);
  };
  const loop = () => { paint(); P.raf = !v.paused && box.isConnected ? requestAnimationFrame(loop) : 0; };
  const state = () => {
    const playing = !v.paused && !v.ended;
    pp.innerHTML = ui.icon(playing ? 'pause-fill' : 'play-fill');
    pp.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    box.classList.toggle('is-paused', !playing);
    if (playing && !P.raf) P.raf = requestAnimationFrame(loop);
    paint(); show(); paintMainBtn(s);
  };
  P.toggle = () => { if (v.paused || v.ended) { if (v.ended) v.currentTime = 0; const q = v.play(); if (q && q.catch) q.catch(() => state()); } else v.pause(); };
  const start = from != null ? from : media.resumeAt(x.id);
  if (start > 0) {
    const jump = () => { try { v.currentTime = start; } catch (_) {} paint(); };
    if (v.readyState >= 1) jump(); else v.addEventListener('loadedmetadata', jump, {once: true});
  }
  ['play', 'pause'].forEach(t => v.addEventListener(t, () => { state(); if (t === 'pause') save(true); }));
  v.addEventListener('ended', () => { save(true); state(); });
  v.addEventListener('timeupdate', () => { if (!P.raf) paint(); save(false); });
  v.addEventListener('loadedmetadata', paint);
  v.addEventListener('playing', () => host.classList.add('is-loaded'));
  v.addEventListener('error', () => {
    box.classList.add('is-error');
    const out = x.src && x.src.drive ? press.openOf({drive: x.src.drive}) : null;
    box.insertAdjacentHTML('beforeend', `<p class="mr-v-err" role="status">Couldn't play this video.${out ? ` <a href="${esc(out.url)}" target="_blank" rel="noopener noreferrer">${esc(out.label)}</a>` : ''}</p>`);
  }, {once: true});
  box.addEventListener('click', e => {
    if (e.target.closest('[data-mr-pp]')) { P.toggle(); return; }
    const sk = e.target.closest('[data-mr-skip]');
    if (sk) { const d = v.duration || 0; v.currentTime = Math.max(0, Math.min(d || 0, v.currentTime + Number(sk.dataset.mrSkip))); paint(); show(); return; }
    if (e.target.closest('[data-mr-fs]')) { fullScreen(v, box); return; }
    if (e.target.closest('input')) return;
    // a tap on the picture: the controls come and go while it plays; paused, it plays
    if (v.paused) P.toggle(); else if (box.classList.contains('is-shown')) { clearTimeout(P.hideT); box.classList.remove('is-shown'); } else show();
  });
  const seekTo = () => { const d = v.duration; if (d > 0 && isFinite(d)) v.currentTime = Number(seek.value) / 1000 * d; paint(); };
  seek.addEventListener('pointerdown', () => { dragging = true; show(); });
  seek.addEventListener('input', () => { dragging = true; seekTo(); show(); });
  seek.addEventListener('change', () => { seekTo(); dragging = false; save(true); show(); });
  ['pointerup', 'pointercancel', 'blur'].forEach(t => seek.addEventListener(t, () => { if (dragging) { dragging = false; show(); } }));
  box.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') show(); });
  box.addEventListener('focusin', show);
  const q = v.play();
  if (q && q.catch) q.catch(() => state()); // a refused start waits paused, the controls up
  state();
}
function fullScreen(v, box) {
  try {
    if (box.requestFullscreen) { const q = box.requestFullscreen(); if (q && q.catch) q.catch(() => { if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); }); return; }
    if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  } catch (_) {}
}
function stopPlayer(s) {
  const P = s.player;
  if (!P) return;
  s.player = null;
  P.dead = true;
  clearTimeout(P.hideT); cancelAnimationFrame(P.raf);
  if (P.v) { try { if (P.save) P.save(true); if (document.fullscreenElement && P.box && P.box.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {}); P.v.pause(); P.v.removeAttribute('src'); P.v.load(); } catch (_) {} }
  P.host.querySelectorAll('.mr-v, .mr-ifr').forEach(n => n.remove());
  P.host.classList.remove('is-on', 'is-loaded');
}
function paintMainBtn(s) {
  const b = s.sheet && s.sheet.el.querySelector('[data-mr-main-play]');
  if (!b) return;
  const x = s.sheet.x, P = s.player, on = !!P && (!P.v || !P.v.paused);
  const at = media.resumeAt(x.id);
  const label = on ? 'Start over' : P && P.v ? 'Play' : at ? `Resume from ${clock(at)}` : 'Play';
  b.innerHTML = ui.icon(on ? 'swap' : 'play-fill') + `<span>${esc(label)}</span>`;
  b.classList.toggle('is-over', on);
}

function openTitle(s, id, {play = false} = {}) {
  const x = catalogue(s).byId.get(id);
  if (!x || s.dead) return;
  if (s.sheet) { swapTitle(s, x, play); return; }
  const sheet = ui.openSheet({detents: ['large'], cls: 'mr-sheet', chrome: false, label: x.title, body: detailHTML(s, x),
    onClose: () => { stopPlayer(s); if (s.sheet === rec) s.sheet = null; repaint(s); }});
  const rec = {el: sheet.el, x, close: sheet.close};
  s.sheet = rec;
  rec.el.addEventListener('click', e => onSheetClick(s, e));
  if (play) startPlayer(s, x);
}
function swapTitle(s, x, play) {
  stopPlayer(s);
  const body = s.sheet.el.querySelector('.sheet-body');
  if (!body) return;
  s.sheet.x = x;
  body.innerHTML = detailHTML(s, x);
  body.scrollTop = 0;
  s.sheet.el.setAttribute('aria-label', x.title);
  if (play) startPlayer(s, x);
}
function onSheetClick(s, e) {
  if (!s.sheet) return;
  const x = s.sheet.x;
  if (e.target.closest('[data-mr-go]')) { startPlayer(s, x); return; }
  if (e.target.closest('[data-mr-main-play]')) {
    const P = s.player;
    if (P && P.v && !P.v.paused) { P.v.currentTime = 0; return; }
    if (P && P.v) { P.toggle(); return; }
    if (P) return; // (YouTube's player is already up)
    startPlayer(s, x);
    s.sheet.el.querySelector('.sheet-body').scrollTo({top: 0, behavior: ui.RM ? 'auto' : 'smooth'});
    return;
  }
  const sw = e.target.closest('[data-mr-swap]');
  if (sw) { const y = catalogue(s).byId.get(sw.dataset.mrSwap); if (y) { ui.haptic('light'); swapTitle(s, y, true); } }
}
function closeTitle(s) {
  stopPlayer(s);
  const rec = s.sheet;
  s.sheet = null;
  if (rec && rec.close) rec.close();
}

// ============================================================================ The screen
function repaint(s) {
  if (s.dead || !s.main) return;
  const html = mainHTML(s);
  if (s.main.dataset.sig === html) return;
  // the rails keep where they were scrolled to
  const pos = [...s.main.querySelectorAll('.mr-rail')].map(r => r.scrollLeft);
  s.main.dataset.sig = html;
  s.main.innerHTML = html;
  [...s.main.querySelectorAll('.mr-rail')].forEach((r, i) => { if (pos[i]) r.scrollLeft = pos[i]; });
}
function setFilter(s, f) {
  if (!FILTERS.some(x => x.id === f) || f === s.filter) return;
  s.filter = f;
  ui.lsSet(FILTER_KEY, f);
  s.el.querySelectorAll('[data-mr-filter]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mrFilter === f)));
  const go = () => { repaint(s); if (s.ctx.screen) s.ctx.screen.scrollTop = 0; };
  if (s.ctx.visible && !ui.RM) ui.crossfade(s.main, go, {duration: 140}); else go();
}
function onScroll(s) {
  const y = s.ctx.screen ? s.ctx.screen.scrollTop : 0;
  const on = y > 24;
  if (s.solid !== on) { s.solid = on; s.bar.classList.toggle('is-solid', on); }
}
function newState(ctx, el) {
  const peek = safe(() => [press.peek()])[0];
  return {ctx, el, main: null, bar: null, dead: false, filter: filterNow(), list: peek && peek.list && peek.list.length ? peek.list : null,
    meals: null, draft: null, err: false, sheet: null, player: null, unsub: null, solid: false, scroll: null};
}

export default {
  id: 'media',
  chrome: 'none',
  title: 'Media Room',

  render(ctx) {
    const s = newState(ctx, null);
    return `<div class="mr">${barHTML(s.filter)}<div class="mr-main" data-mr-main>${mainHTML(s)}</div></div>`;
  },

  mount(el, ctx) {
    const s = newState(ctx, el);
    ST.set(ctx, s);
    s.main = el.querySelector('[data-mr-main]');
    s.bar = el.querySelector('[data-mr-bar]');
    document.documentElement.classList.add('is-media');
    ui.lsSet('gg-media-seen', '1'); // (its case on the shelf: views/games.js)
    el.addEventListener('click', s.onClick = e => {
      const f = e.target.closest('[data-mr-filter]');
      if (f) { setFilter(s, f.dataset.mrFilter); return; }
      const p = e.target.closest('[data-mr-play]');
      if (p) { ui.haptic('light'); openTitle(s, p.dataset.mrPlay, {play: true}); return; }
      const o = e.target.closest('[data-mr-open]');
      if (o) { ui.haptic('light'); openTitle(s, o.dataset.mrOpen, {play: o.classList.contains('mr-card') || o.classList.contains('mr-top') || o.classList.contains('mr-ep')}); }
    });
    el.addEventListener('keydown', s.onKey = e => {
      const t = e.target.closest('[data-mr-filter]');
      if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const i = FILTERS.findIndex(x => x.id === t.dataset.mrFilter), n = FILTERS.length;
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
      setFilter(s, FILTERS[j].id);
      const b = el.querySelector(`[data-mr-filter="${FILTERS[j].id}"]`); if (b) b.focus();
    });
    if (ctx.screen) { s.scroll = () => onScroll(s); ctx.screen.addEventListener('scroll', s.scroll, {passive: true}); }
    try {
      s.unsub = press.subscribePressers(u => {
        if (s.dead || !u) return;
        const list = (Array.isArray(u.list) ? u.list : []).filter(p => p && p.key && press.playable(p));
        if (u.ready || list.length) { s.list = list; repaint(s); }
        else if (u.error && !s.list) { s.list = []; repaint(s); }
      });
    } catch (e) { console.error(e); s.list = []; }
    media.load().then(m => { if (s.dead) return; s.meals = m.meals; s.draft = m.draft; repaint(s); },
      e => { console.warn('media: data/media.json unavailable', e); if (s.dead) return; s.meals = []; s.err = true; repaint(s); });
    // a phone that's slow to answer still gets its page: the pressers' seed is all the Media Room needs
    s.slow = setTimeout(() => { if (!s.dead && !s.list) { s.list = safe(() => press.peek().list); repaint(s); } }, 6000);
  },

  onShow(ctx) {
    const s = ST.get(ctx);
    if (!s) return;
    document.documentElement.classList.add('is-media');
    repaint(s);
  },

  onHide(ctx) {
    // nothing plays on a hidden screen; the title page goes with it
    const s = ST.get(ctx);
    document.documentElement.classList.remove('is-media');
    if (s) closeTitle(s);
  },

  update(ctx) {
    const s = ST.get(ctx);
    if (s) repaint(s);
  },

  unmount(el, ctx) {
    const s = ST.get(ctx);
    document.documentElement.classList.remove('is-media');
    if (!s) return;
    closeTitle(s);
    s.dead = true;
    clearTimeout(s.slow);
    el.removeEventListener('click', s.onClick);
    el.removeEventListener('keydown', s.onKey);
    if (s.scroll && ctx.screen) ctx.screen.removeEventListener('scroll', s.scroll);
    if (typeof s.unsub === 'function') { try { s.unsub(); } catch (_) {} }
    ST.delete(ctx);
  }
};

export const __dev = {catalogue, mealItem, pressItem, states: ST};
