// Exercise the actual service worker handlers without a browser or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const handlers = {}, added = [], stored = [], fetched = [];
const scope = 'https://example.test/gridiron-gangbang/';
const response = {ok: true, type: 'basic', clone() { return this; }};
const cache = {add: async req => { added.push(req.url); }, put: async req => { stored.push(req.url || req); }};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../sw.js'), 'utf8'), {
  self: {location: {origin: 'https://example.test'}, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {}, clients: {claim: async () => {}}},
  caches: {open: async () => cache, match: async () => null, keys: async () => [], delete: async () => true},
  fetch: async req => { fetched.push(req.url || req); return response; },
  Request: class extends Request { constructor(url, options) { super(new URL(url, scope), options); } },
  Response, URL, setTimeout
});
(async () => {
  let done;
  handlers.install({waitUntil(p) { done = p; }});
  await done;
  assert(added.some(url => url.endsWith('/js/views/return-city-bus.js')));
  assert(!added.some(url => /\/img\/return\/city\//.test(url)), 'Owner art must not be precached');
  for (const face of ['rear', 'side', 'roof']) {
    handlers.fetch({request: new Request(scope + `img/return/city/bus-${face}-v1.webp`), respondWith(p) { done = p; }});
    await done;
  }
  assert.equal(fetched.length, 3);
  assert.equal(stored.length, 0, 'Owner art must not enter shared runtime cache');
  handlers.fetch({request: new Request(scope + 'img/return.webp'), respondWith(p) { done = p; }});
  await done;
  assert(stored.some(url => url.endsWith('/img/return.webp')), 'Existing image caching remains intact');
  console.log('PASS: owner art excluded from shared install/runtime cache; existing caching preserved.');
})().catch(error => { console.error(error); process.exitCode = 1; });
