// Run the real worker against complete, partial and offline media requests; no network or app writes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), bytes = fs.readFileSync(path.join(root, 'audio/rivals/sundress-v1.mp3'));
const origin = 'https://example.test', url = origin + '/gridiron/audio/rivals/sundress-v1.mp3';
const entries = new Map(), handlers = {}, writes = [], background = [];
let offline = false, downloads = 0;
const box = vm.createContext({URL, Request, Response, setTimeout,
  self: {location: {origin}, addEventListener: (name, fn) => handlers[name] = fn},
  caches: {match: async key => entries.get(typeof key === 'string' ? key : key.url)?.clone(),
    open: async () => ({put: (key, response) => { const write = response.arrayBuffer().then(b => entries.set(typeof key === 'string' ? key : key.url, new Response(b, {headers: {'Content-Type':'audio/mpeg'}}))); writes.push(write); return write; }})},
  fetch: async (key, options) => {
    downloads++; if (offline) throw Error('offline');
    assert.equal(typeof key, 'string'); assert.equal(key, url); assert.equal(options.credentials, 'same-origin');
    return new Response(bytes, {headers: {'Content-Type':'audio/mpeg'}});
  }
});
vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), box);
const request = range => {
  let response;
  handlers.fetch({request: new Request(url, {headers: range ? {Range:range} : {}}), respondWith: value => response = value, waitUntil: value => background.push(value)});
  return response;
};
async function browserCheck() {
  const http = require('node:http');
  let pw; try { pw = require('playwright'); } catch (_) { pw = require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
  let trackDownloads = 0;
  // Real worker and MP3, with tiny stand-ins for unrelated shell assets. No Firebase or remote traffic.
  const server = http.createServer((req,res) => {
    const name = new URL(req.url,'http://localhost').pathname;
    if (name === '/sw.js') { res.setHeader('Content-Type','text/javascript'); return res.end(fs.readFileSync(path.join(root,'sw.js'))); }
    if (name === '/audio/rivals/sundress-v1.mp3') { trackDownloads++; res.setHeader('Content-Type','audio/mpeg'); return res.end(bytes); }
    if (name === '/') { res.setHeader('Content-Type','text/html'); return res.end('<button id="play">Play</button><script>window.song=new Audio("/audio/rivals/sundress-v1.mp3");song.preload="none";song.loop=true;document.getElementById("play").onclick=()=>song.play();</script>'); }
    res.end('fixture');
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const browser = await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const ctx = await browser.newContext(), page = await ctx.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert.equal(trackDownloads,0,'install never precaches the track');
    const first = await page.evaluate(async () => { const r=await fetch('/audio/rivals/sundress-v1.mp3',{headers:{Range:'bytes=0-1'}}); return {status:r.status,length:(await r.arrayBuffer()).byteLength}; });
    assert.deepEqual(first,{status:206,length:2});
    await page.waitForFunction(async () => (await caches.match('/audio/rivals/sundress-v1.mp3'))?.status === 200);
    await ctx.setOffline(true);
    const suffix = await page.evaluate(async () => { const r=await fetch('/audio/rivals/sundress-v1.mp3',{headers:{Range:'bytes=-128'}}); return {status:r.status,length:(await r.arrayBuffer()).byteLength}; });
    assert.deepEqual(suffix,{status:206,length:128});
    await page.locator('#play').click();
    await page.waitForFunction(() => song.currentTime > .1 && !song.paused);
    await page.evaluate(() => { song.currentTime=song.duration-.15; });
    await page.waitForFunction(() => song.currentTime<2 && !song.paused);
    assert.equal(trackDownloads,1,'offline playback and looping use the complete cached track');
    await ctx.close(); console.log('PASS real service worker: first-use cache, offline MP3 decoding, seeking and looping');
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
}
(async () => {
  let r = await request('bytes=0-1'); assert.equal(r.status, 206); assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes.subarray(0,2));
  await Promise.all(background); await Promise.all(writes);
  assert.equal(background.length,1,'worker stays alive until the complete track is cached');
  assert.equal(downloads,1); assert.equal(entries.get(url).status,200);
  offline = true;
  for (const [range, start, end] of [['bytes=100-199',100,199],['bytes=100-',100,bytes.length-1],['bytes=-128',bytes.length-128,bytes.length-1],['bytes=0-999999999',0,bytes.length-1]]) {
    r = await request(range); assert.equal(r.status,206);
    assert.equal(r.headers.get('Content-Range'),`bytes ${start}-${end}/${bytes.length}`);
    assert.equal(r.headers.get('Content-Length'),String(end-start+1)); assert.equal(r.headers.get('Content-Type'),'audio/mpeg');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes.subarray(start,end+1));
  }
  for (const range of ['bytes=999999999-','bytes=4-2','bytes=-0','bytes=-','bytes=0-1,3-5','nonsense']) {
    r = await request(range); assert.equal(r.status,416); assert.equal(r.headers.get('Content-Range'),`bytes */${bytes.length}`);
  }
  r = await request(); assert.equal(r.status,200); assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);
  assert.equal(downloads,1,'cached playback never refetches the track');
  assert.equal(vm.runInContext(`isCacheFirst(new URL('${url}'))`,box),true,'worker updates preserve previously played music');
  assert.equal(vm.runInContext("SHELL.some(p => p.endsWith('.mp3'))",box),false,'no global audio precache');
  let handled = false;
  handlers.fetch({request: new Request(origin+'/unrelated.mp3'),respondWith: () => handled=true});
  assert.equal(handled,false,'unrelated media retains its existing behavior');
  console.log('PASS MP3 worker: full file cached once, offline ranges/suffixes/seeks, invalid ranges, update preservation, scoped on-demand download');
  if (process.argv.includes('--browser')) await browserCheck();
})().catch(e => { console.error(e); process.exitCode=1; });
