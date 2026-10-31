// Home's app grid and the tab bar share one transition, owned by the shell's navigation lifecycle.
// Measure after the destination is ready, move compositor layers, then hand back at the page's commit.
import * as ui from './ui.js';

const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const EASE = 'cubic-bezier(.22,1,.36,1)';
let currentScreen = null, active = null;
const isHome = screen => !!(screen && screen.isConnected && screen.dataset.path === '/puzzles' && screen.querySelector('.hm-apps'));
const homeState = screen => html.classList.toggle('is-home', isHome(screen));

function clearTransition() {
  const previous = active;
  active = null;
  if (previous) {
    clearTimeout(previous.timer);
    previous.cleanup();
    previous.animations.forEach(animation => animation.cancel());
    previous.layer.remove();
  }
  html.classList.remove('hm-morph');
}

/** Reconcile the chrome with the committed screen, including boot, interrupted navigation and unmounts. */
export function syncHomeChrome(screen) {
  clearTransition();
  currentScreen = screen || null;
  homeState(currentScreen);
}

const box = r => ({x: r.left, y: r.top, w: r.width, h: r.height});
const relative = (r, origin) => ({x: r.x - origin.x, y: r.y - origin.y, w: r.w, h: r.h});
const place = (element, r) => Object.assign(element.style, {left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`});
const lookOf = element => {
  const style = getComputedStyle(element);
  // Moving stand-ins never blur/re-sample the pages underneath them.
  return {backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage,
    boxShadow: style.boxShadow, borderRadius: style.borderRadius};
};

/** A pressed tile or tab may be scaled, but its unscaled centre and layout size are stable. */
function restingBox(element) {
  const r = element.getBoundingClientRect(), w = element.offsetWidth, h = element.offsetHeight;
  return {x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h};
}

function measure(screen, fromHome) {
  const bar = document.getElementById('tabbar'), grid = screen.querySelector('.hm-apps');
  if (!bar || !bar.parentElement || !bar.offsetParent || !grid) return null;
  const host = bar.parentElement, origin = box(host.getBoundingClientRect());
  const bounds = box(grid.getBoundingClientRect());
  const viewport = {left: Math.max(0, origin.x), top: Math.max(0, origin.y),
    right: Math.min(innerWidth, origin.x + origin.w), bottom: Math.min(innerHeight, origin.y + origin.h)};
  if (!bounds.w || !bounds.h || bounds.x < viewport.left - 1 || bounds.y < viewport.top - 1
    || bounds.x + bounds.w > viewport.right + 1 || bounds.y + bounds.h > viewport.bottom + 1) return null;
  const barStyle = getComputedStyle(bar);
  if (!fromHome && (barStyle.visibility === 'hidden' || +barStyle.opacity < .9)) return null;
  // The home bar is translated down by CSS. Read its layout position without changing global classes first.
  const parent = bar.offsetParent, parentBox = parent.getBoundingClientRect(), paintedBar = bar.getBoundingClientRect();
  const naturalBar = {x: parentBox.left + parent.clientLeft + bar.offsetLeft,
    y: parentBox.top + parent.clientTop + bar.offsetTop, w: bar.offsetWidth, h: bar.offsetHeight};
  if (!naturalBar.w || !naturalBar.h) return null;
  const delta = {x: naturalBar.x - paintedBar.left, y: naturalBar.y - paintedBar.top};
  const tabs = [...bar.querySelectorAll('.tab:not([hidden])')].map(button => {
    const icon = button.querySelector('.tab-ic'), at = restingBox(icon);
    at.x += delta.x; at.y += delta.y;
    return {tab: button.dataset.tab, at: relative(at, origin), on: button.getAttribute('aria-current') === 'page',
      color: getComputedStyle(button).color, icon: (button.querySelector('.ic-off use')?.getAttribute('href') || '').replace('#i-', '')};
  });
  const apps = [...grid.querySelectorAll('.hm-app')].map(button => {
    const tile = button.querySelector('.hm-ic');
    return {tab: button.dataset.goTab, at: relative(restingBox(tile), origin), look: lookOf(tile)};
  }).filter(app => tabs.some(tab => tab.tab === app.tab));
  if (!apps.length || apps.some(app => !app.at.w || !app.at.h)) return null;
  return {bar, host, at: relative(naturalBar, origin), look: lookOf(bar), apps, tabs,
    ink: tabs.find(tab => !tab.on)?.color || barStyle.color,
    tint: tabs.find(tab => tab.on)?.color || barStyle.getPropertyValue('--tint')};
}

/** Start only once both screens are prepared at their natural positions, before the page slide begins. */
export function beginHomeTransition(fromScreen, toScreen, tab, duration = 240) {
  clearTransition();
  homeState(currentScreen);
  const out = isHome(fromScreen), into = isHome(toScreen);
  if (out === into || ui.RM || reduced.matches || document.hidden || !Element.prototype.animate) {
    homeState(toScreen); return;
  }
  const measured = measure(out ? fromScreen : toScreen, out);
  if (!measured) { homeState(toScreen); return; }
  const {apps, tabs, at} = measured, animations = [], flights = [];
  const layer = document.createElement('div');
  layer.className = 'hm-morph-layer';
  layer.setAttribute('aria-hidden', 'true');
  const ms = Math.min(240, Math.max(1, Number(duration) || 240));
  const options = {duration: ms, easing: EASE, fill: 'both'};
  const fly = (element, from, to) => flights.push([element, out ? [from, to] : [to, from]]);
  const cap = document.createElement('div');
  cap.className = 'hm-morph-cap';
  Object.assign(cap.style, measured.look);
  place(cap, at); layer.append(cap);
  const left = Math.min(...apps.map(app => app.at.x)) - 12, top = Math.min(...apps.map(app => app.at.y)) - 12;
  const width = Math.max(...apps.map(app => app.at.x + app.at.w)) + 12 - left;
  const height = Math.max(...apps.map(app => app.at.y + app.at.h)) + 12 - top;
  fly(cap, {transform: `translate3d(${left - at.x}px,${top - at.y}px,0) scale(${width / at.w},${height / at.h})`, opacity: 0},
    {transform: 'translate3d(0,0,0) scale(1)', opacity: 1});
  apps.forEach(app => {
    const target = tabs.find(item => item.tab === app.tab), lit = out ? target.tab === tab : target.on;
    const ghost = document.createElement('div');
    ghost.className = 'hm-ghost'; ghost.style.color = measured.ink;
    ghost.innerHTML = '<span class="hm-ic"></span>' + ui.icon(target.icon) + (lit ? ui.icon(target.icon + '-fill') : '');
    place(ghost, app.at); Object.assign(ghost.firstChild.style, app.look); layer.append(ghost);
    const x = target.at.x + target.at.w / 2 - app.at.x - app.at.w / 2;
    const y = target.at.y + target.at.h / 2 - app.at.y - app.at.h / 2;
    fly(ghost, {transform: 'translate3d(0,0,0) scale(1)'}, {transform: `translate3d(${x}px,${y}px,0) scale(${26 / 30})`});
    fly(ghost.firstChild, {opacity: 1}, {opacity: 0});
    if (lit) {
      ghost.children[2].style.color = measured.tint;
      fly(ghost.children[1], {opacity: 1}, {opacity: 0});
      fly(ghost.children[2], {opacity: 0}, {opacity: 1});
    }
  });
  tabs.filter(item => !apps.some(app => app.tab === item.tab)).forEach(item => {
    const ghost = document.createElement('div');
    ghost.className = 'hm-ghost hm-ghost-tab'; ghost.style.color = measured.ink;
    ghost.innerHTML = ui.icon(item.icon, {size: 26});
    place(ghost, item.at); layer.append(ghost);
    fly(ghost, {opacity: 0, transform: 'scale(.8)'}, {opacity: 1, transform: 'scale(1)'});
  });
  // All measurements precede these writes. The real bar retains outbound hit targets during the visual handoff.
  homeState(toScreen);
  html.classList.add('hm-morph');
  measured.host.append(layer);
  // Give every stand-in the same explicit timeline origin, including on browsers that defer play-ready.
  const startTime = document.timeline.currentTime;
  flights.forEach(([element, frames]) => {
    const animation = element.animate(frames, options);
    if (startTime != null) animation.startTime = startTime;
    animations.push(animation);
  });
  const cancel = () => syncHomeChrome(currentScreen);
  const onHidden = () => { if (document.hidden) cancel(); };
  addEventListener('resize', cancel, {passive: true});
  document.addEventListener('visibilitychange', onHidden);
  if (reduced.addEventListener) reduced.addEventListener('change', cancel); else reduced.addListener(cancel);
  const cleanup = () => {
    removeEventListener('resize', cancel);
    document.removeEventListener('visibilitychange', onHidden);
    if (reduced.removeEventListener) reduced.removeEventListener('change', cancel); else reduced.removeListener(cancel);
  };
  // Keep the landing frame until the shell commits; never guess from a view that is still loading.
  active = {layer, animations, cleanup, timer: setTimeout(cancel, ms + 400)};
}
