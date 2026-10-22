// Exercise the real launch controller with a deterministic clock and minimal DOM.
// No browser, network, package installs, or actual waiting is needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../js/views/game-launch.js'), 'utf8');
const game = {id: 'return', name: 'Return Man', disc: '/img/return-disc.webp'};

function harness({reduced = false, observe = true} = {}) {
  let now = 0, nextTimer = 1;
  const timers = new Map(), observers = new Set(), listeners = new Set(), layers = [];
  const motion = {
    matches: reduced,
    addEventListener(type, fn) { assert.equal(type, 'change'); listeners.add(fn); },
    removeEventListener(type, fn) { assert.equal(type, 'change'); listeners.delete(fn); }
  };
  function element() {
    const classes = new Set();
    const node = {
      connected: false, parent: null, children: [], selectors: {},
      get isConnected() { return this.parent ? this.parent.isConnected : this.connected; },
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
        toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
      },
      appendChild(child) { child.parent = this; this.children.push(child); },
      querySelector(selector) { return this.selectors[selector] || null; },
      remove() {
        if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
        this.parent = null; this.connected = false;
      }
    };
    return node;
  }
  const doc = {
    documentElement: {},
    createElement(tag) {
      assert.equal(tag, 'div');
      const layer = element();
      layer.selectors = {img: element(), strong: element()};
      layer.animations = [{cancelled: false}, {cancelled: false}];
      layer.animations.forEach(animation => { animation.cancel = () => { animation.cancelled = true; }; });
      layer.getAnimations = () => layer.animations;
      layers.push(layer);
      return layer;
    }
  };
  const host = element(), dlg = element();
  host.connected = true; host.ownerDocument = doc;
  host.selectors['.gm-z-dlg'] = dlg;
  host.appendChild(dlg);
  const context = {
    module: {exports: {}},
    matchMedia: query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return motion; },
    setTimeout(fn, delay) {
      const id = nextTimer++;
      timers.set(id, {fn, delay, due: now + delay});
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  if (observe) context.MutationObserver = class {
    constructor(fn) { this.fn = fn; }
    observe(target) { assert.equal(target, doc.documentElement); observers.add(this); }
    disconnect() { observers.delete(this); }
  };
  // The source has no imports. Strip its export declaration only; all controller logic runs unchanged.
  vm.runInNewContext(source.replace(/^export function launchGame/m, 'function launchGame')
    + '\nmodule.exports = {launchGame};', context, {filename: 'game-launch.js'});

  function advance(ms) {
    const until = now + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.due; timers.delete(id); timer.fn();
    }
    now = until;
  }
  function assertClean() {
    assert.equal(timers.size, 0, 'No launch timers remain');
    assert.equal(observers.size, 0, 'No mutation observers remain');
    assert.equal(listeners.size, 0, 'No media listeners remain');
    assert.equal(dlg.children.length, 0, 'Launch artwork is removed');
    assert.equal(host.classList.contains('gm-is-launching'), false, 'Original case is restored');
    assert.ok(layers.every(layer => layer.animations.every(animation => animation.cancelled)), 'All animations are cancelled');
  }
  return {
    host, dlg, layers, timers, advance, assertClean,
    launch: options => context.module.exports.launchGame({host, game, ...options}),
    notifyMutation() { [...observers].forEach(observer => observer.fn()); },
    reduceMotion() { motion.matches = true; [...listeners].forEach(fn => fn({matches: true})); }
  };
}

let passed = 0;
function check(name, test) {
  test(); passed++;
  console.log(`PASS: ${name}`);
}

check('completion happens exactly once, with all resources released', () => {
  const h = harness(); let completed = 0;
  const control = h.launch({onComplete: () => completed++});
  const staleTimer = [...h.timers.values()][0].fn;
  assert.equal(h.host.classList.contains('gm-is-launching'), true);
  h.advance(1000); assert.equal(completed, 0, 'Normal motion remains visible for its sequence');
  h.advance(1000); assert.equal(completed, 1);
  staleTimer(); control.cancel(); h.advance(5000);
  assert.equal(completed, 1); h.assertClean();
});

check('cancellation is idempotent and suppresses a queued completion', () => {
  const h = harness(); let completed = 0;
  const control = h.launch({onComplete: () => completed++});
  const staleTimer = [...h.timers.values()][0].fn;
  h.advance(500); control.cancel(); control.cancel(); staleTimer(); h.advance(5000);
  assert.equal(completed, 0); h.assertClean();
});

check('detaching the host cancels immediately without starting the game', () => {
  const h = harness(); let completed = 0;
  h.launch({onComplete: () => completed++});
  h.host.connected = false; h.notifyMutation();
  assert.equal(h.timers.size, 0);
  h.advance(5000); assert.equal(completed, 0); h.assertClean();
});

check('removing the launch layer also cancels the sequence', () => {
  const h = harness(); let completed = 0;
  h.launch({onComplete: () => completed++});
  h.layers[0].remove(); h.notifyMutation(); h.advance(5000);
  assert.equal(completed, 0); h.assertClean();
});

check('completion guards detachment even without MutationObserver', () => {
  const h = harness({observe: false}); let completed = 0;
  h.launch({onComplete: () => completed++});
  h.host.connected = false; h.advance(5000);
  assert.equal(completed, 0); h.assertClean();
});

check('a replacement launch owns the host; stale callbacks cannot end it', () => {
  const h = harness(); let oldCompleted = 0, newCompleted = 0;
  const old = h.launch({onComplete: () => oldCompleted++});
  const staleTimer = [...h.timers.values()][0].fn;
  h.advance(300);
  h.launch({onComplete: () => newCompleted++});
  old.cancel(); staleTimer();
  assert.equal(h.dlg.children.length, 1, 'Only the replacement artwork remains');
  assert.equal(h.host.classList.contains('gm-is-launching'), true);
  assert.equal(h.timers.size, 1);
  h.advance(2000);
  assert.equal(oldCompleted, 0); assert.equal(newCompleted, 1); h.assertClean();
});

for (const preference of ['explicit', 'system']) check(`${preference} reduced motion uses a short stationary presentation`, () => {
  const h = harness({reduced: preference === 'system'}); let completed = 0;
  h.launch({reducedMotion: preference === 'explicit', onComplete: () => completed++});
  assert.equal(h.layers[0].classList.contains('is-reduced'), true);
  const delay = [...h.timers.values()][0].delay;
  assert.ok(delay > 0 && delay <= 200, 'Reduced motion completes within 200ms');
  h.advance(200); assert.equal(completed, 1); h.assertClean();
});

check('enabling reduced motion mid-sequence cancels movement and finishes promptly', () => {
  const h = harness(); let completed = 0;
  h.launch({onComplete: () => completed++});
  h.advance(400); h.reduceMotion();
  assert.equal(h.layers[0].classList.contains('is-reduced'), true);
  assert.ok(h.layers[0].animations.every(animation => animation.cancelled));
  assert.equal(h.timers.size, 1, 'The original completion timer was replaced');
  h.advance(200); assert.equal(completed, 1); h.advance(2000);
  assert.equal(completed, 1); h.assertClean();
});

console.log(`${passed} launch lifecycle checks passed.`);
