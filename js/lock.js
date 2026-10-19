// lock.js: portrait only, on every phone. The manifest keeps an installed app upright on Android, but an iPhone turns
// the page on its side with the phone. So a phone held sideways has the whole app turned back a quarter turn (the
// body, css/base.css :root.is-rot), and the app stays the way the phone holds it, like an app locked to portrait.
// While it's turned, what the page reads in screen terms is made the app's own: where a touch or a click is
// (clientX/Y, pageX/Y, x/y), where an element is (getBoundingClientRect, getClientRects, an IntersectionObserver's
// rects), how big the screen is (innerWidth/innerHeight, visualViewport) and what's at a point (elementFromPoint);
// the safe areas (the notch, the home bar) follow (css/tokens.css --sa-*). Tablets and computers (taller, or with a
// mouse) are never turned. A classic script in <head>, before the app's modules and the first paint.
// window.GGLock: {turn()} (0, or the quarter turn the app is drawn at: 90 with the phone's top to the right, -90 to
// the left). Owner: foundation.
(function () {
  'use strict';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(orientation: landscape) and (max-height: 540px) and (hover: none) and (pointer: coarse)') : null;
  // rot: the app's turn; VW, VH: the screen as the browser has it (wide), measured unturned.
  var rot = 0, VW = 0, VH = 0;
  var own = function (o, k) { while (o && !Object.getOwnPropertyDescriptor(o, k)) o = Object.getPrototypeOf(o); return o ? Object.getOwnPropertyDescriptor(o, k) : null; };
  var dW = own(window, 'innerWidth'), dH = own(window, 'innerHeight');
  var realW = function () { return dW && dW.get ? dW.get.call(window) : root.clientWidth; };
  var realH = function () { return dH && dH.get ? dH.get.call(window) : root.clientHeight; };

  // The screen's point (vx, vy) as the app's, and back. Turned -90 the app's top is at the screen's left; 90, its right.
  var toApp = function (vx, vy) { return rot === -90 ? [VH - vy, vx] : [vy, VW - vx]; };
  var toScreen = function (ax, ay) { return rot === -90 ? [ay, VH - ax] : [VW - ay, ax]; };
  var rectApp = function (r) {
    if (!r) return r;
    var a = toApp(r.left, r.top), b = toApp(r.right, r.bottom), x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
    return new DOMRect(x, y, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  };

  /** Which way the phone's top points: the angle it's turned from upright (90: to the left, -90: to the right). */
  function angle() {
    if (typeof window.orientation === 'number') return window.orientation;
    var s = window.screen && window.screen.orientation;
    if (s && typeof s.angle === 'number') return s.angle > 180 ? s.angle - 360 : s.angle;
    return -90;
  }
  function apply() {
    var r = mq && mq.matches ? (angle() === 90 ? -90 : 90) : 0;
    rot = 0;
    VW = realW(); VH = realH();
    rot = r;
    root.classList.toggle('is-rot', !!r);
    root.classList.toggle('is-rot-l', r === -90);
    root.classList.toggle('is-rot-r', r === 90);
    root.style.setProperty('--lock-w', VW + 'px');
    root.style.setProperty('--lock-h', VH + 'px');
  }

  // A pair of getters (an x and its y) made the app's while it's turned.
  function pair(proto, xk, yk) {
    var dx = proto && own(proto, xk), dy = proto && own(proto, yk);
    if (!dx || !dy || !dx.get || !dy.get) return;
    Object.defineProperty(proto, xk, {configurable: true, enumerable: dx.enumerable, get: function () {
      var x = dx.get.call(this);
      return rot ? toApp(x, dy.get.call(this))[0] : x;
    }});
    Object.defineProperty(proto, yk, {configurable: true, enumerable: dy.enumerable, get: function () {
      var y = dy.get.call(this);
      return rot ? toApp(dx.get.call(this), y)[1] : y;
    }});
  }
  // A getter returning a rect, made the app's.
  function rectGetter(proto, k) {
    var d = proto && own(proto, k);
    if (!d || !d.get) return;
    Object.defineProperty(proto, k, {configurable: true, enumerable: d.enumerable, get: function () {
      var r = d.get.call(this);
      return rot ? rectApp(r) : r;
    }});
  }
  try {
    if (window.MouseEvent) { pair(MouseEvent.prototype, 'clientX', 'clientY'); pair(MouseEvent.prototype, 'pageX', 'pageY'); pair(MouseEvent.prototype, 'x', 'y'); }
    if (window.Touch) { pair(Touch.prototype, 'clientX', 'clientY'); pair(Touch.prototype, 'pageX', 'pageY'); }
    var gbcr = Element.prototype.getBoundingClientRect, gcr = Element.prototype.getClientRects;
    Element.prototype.getBoundingClientRect = function () { var r = gbcr.call(this); return rot ? rectApp(r) : r; };
    Element.prototype.getClientRects = function () {
      var l = gcr.call(this);
      if (!rot) return l;
      var out = [];
      for (var i = 0; i < l.length; i++) out.push(rectApp(l[i]));
      out.item = function (i) { return out[i] || null; };
      return out;
    };
    if (window.IntersectionObserverEntry) ['boundingClientRect', 'intersectionRect', 'rootBounds'].forEach(function (k) { rectGetter(IntersectionObserverEntry.prototype, k); });
    var efp = Document.prototype.elementFromPoint, efps = Document.prototype.elementsFromPoint;
    Document.prototype.elementFromPoint = function (x, y) { if (!rot) return efp.call(this, x, y); var p = toScreen(x, y); return efp.call(this, p[0], p[1]); };
    if (efps) Document.prototype.elementsFromPoint = function (x, y) { if (!rot) return efps.call(this, x, y); var p = toScreen(x, y); return efps.call(this, p[0], p[1]); };
    Object.defineProperty(window, 'innerWidth', {configurable: true, enumerable: true, get: function () { return rot ? VH : realW(); }});
    Object.defineProperty(window, 'innerHeight', {configurable: true, enumerable: true, get: function () { return rot ? VW : realH(); }});
    if (window.VisualViewport) {
      var vp = VisualViewport.prototype, vw = own(vp, 'width'), vh = own(vp, 'height');
      if (vw && vh && vw.get && vh.get) {
        Object.defineProperty(vp, 'width', {configurable: true, enumerable: true, get: function () { return rot ? vh.get.call(this) : vw.get.call(this); }});
        Object.defineProperty(vp, 'height', {configurable: true, enumerable: true, get: function () { return rot ? vw.get.call(this) : vh.get.call(this); }});
      }
      ['offsetTop', 'offsetLeft', 'pageTop', 'pageLeft'].forEach(function (k) {
        var d = own(vp, k);
        if (d && d.get) Object.defineProperty(vp, k, {configurable: true, enumerable: true, get: function () { return rot ? 0 : d.get.call(this); }});
      });
    }
  } catch (e) { /* (a browser without one of these: it goes on unturned where it can't be helped) */ }

  // Scrolling while it's turned: the browser's own touch scrolling goes by the screen's axes, not the turned app's, so
  // a drag nothing in the app has taken for itself (a sheet pulled down, a swipe to the next tab: they cancel the
  // touchmove) scrolls what's under the finger by hand, up and down or across as the app has it (the axis locked on
  // the first few px, as the browser does), and carries on with the flick when the finger lifts. Never in something
  // that takes its own drags (touch-action none, or pan-y across: a view's own swipe). A touch stops a fling. The
  // browser's own pan is kept off while it's turned (no use, and it mustn't scroll as well), but on fields and sliders.
  var drag = null, fling = 0;
  var FIELD = 'input, textarea, select, [contenteditable="true"], [role="slider"]';
  function scrollerFor(el, axis) {
    for (var n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
      var cs = getComputedStyle(n), ta = cs.touchAction;
      if (ta === 'none' || (axis === 'x' && ta === 'pan-y') || (axis === 'y' && ta === 'pan-x')) return null;
      var o = axis === 'y' ? cs.overflowY : cs.overflowX;
      if ((o === 'auto' || o === 'scroll') && (axis === 'y' ? n.scrollHeight > n.clientHeight + 1 : n.scrollWidth > n.clientWidth + 1)) return n;
    }
    return null;
  }
  var pos = function (el, axis) { return axis === 'y' ? el.scrollTop : el.scrollLeft; };
  var setPos = function (el, axis, v) { if (axis === 'y') el.scrollTop = v; else el.scrollLeft = v; };
  function stopFling() { if (fling) { cancelAnimationFrame(fling); fling = 0; } }
  window.addEventListener('touchstart', function (e) {
    stopFling();
    drag = null;
    if (!rot || e.touches.length !== 1) return;
    var t = e.touches[0], tg = e.target;
    drag = {x0: t.clientX, y0: t.clientY, target: tg, field: !!(tg && tg.closest && tg.closest(FIELD)), axis: null, el: null, s: []};
  }, {capture: true, passive: true});
  window.addEventListener('touchmove', function (e) {
    if (!rot || e.touches.length !== 1) { drag = null; return; }
    var taken = e.defaultPrevented;
    if (!taken && e.cancelable && !(drag && drag.field)) e.preventDefault();
    if (!drag || taken || drag.field) { drag = null; return; }
    var t = e.touches[0], dx = t.clientX - drag.x0, dy = t.clientY - drag.y0;
    if (!drag.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      drag.el = scrollerFor(drag.target, drag.axis);
      if (!drag.el) { drag = null; return; }
      drag.p0 = pos(drag.el, drag.axis);
      drag.d0 = drag.axis === 'y' ? dy : dx;
      // (no snapping under the finger; it's put back for the fling's end)
      drag.snap = drag.el.style.scrollSnapType;
      drag.el.style.scrollSnapType = 'none';
    }
    var d = (drag.axis === 'y' ? dy : dx) - drag.d0;
    setPos(drag.el, drag.axis, drag.p0 - d);
    drag.s.push([performance.now(), d]);
    if (drag.s.length > 8) drag.s.shift();
  }, {passive: false});
  function endDrag() {
    var g = drag;
    drag = null;
    if (!g || !g.el) return;
    var s = g.s, v = 0, now = performance.now();
    if (s.length > 1 && now - s[s.length - 1][0] < 80) {
      var a = s[0], b = s[s.length - 1];
      if (b[0] > a[0]) v = -(b[1] - a[1]) / (b[0] - a[0]); // px a ms, along the scroll
    }
    var el = g.el, axis = g.axis;
    el.style.scrollSnapType = g.snap;
    if (getComputedStyle(el).scrollSnapType.indexOf('none') < 0) {
      // A snapping strip: the browser lands it on a stop, past the flick's way.
      var by = {behavior: 'smooth'};
      by[axis === 'y' ? 'top' : 'left'] = v * 160;
      el.scrollBy(by);
      return;
    }
    // A fling: on at the speed it was let go at, slowing as a phone's does (a third of a second to ease off).
    var last = now;
    (function step(tm) {
      var dt = Math.min(40, tm - last);
      last = tm;
      v *= Math.exp(-dt / 325);
      var before = pos(el, axis);
      setPos(el, axis, before + v * dt);
      if (Math.abs(v) < 0.02 || pos(el, axis) === before && dt > 0) { fling = 0; return; }
      fling = requestAnimationFrame(step);
    })(now);
  }
  window.addEventListener('touchend', endDrag, {passive: true});
  window.addEventListener('touchcancel', function () { drag = null; }, {passive: true});

  apply();
  // Before the app's own resize handlers (this runs first), so they measure the app turned or not.
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) window.screen.orientation.addEventListener('change', apply);
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  window.GGLock = {turn: function () { return rot; }};
})();
