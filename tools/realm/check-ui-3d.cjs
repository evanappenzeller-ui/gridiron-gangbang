// The real Keepfall screens over the real 3D (the full 3D Keepfall, Oct 25 2026): home, a building's card, the shop and
// the army, on a phone held both ways, for Evan, another member and a guest. Local fixture: no board backend, no real
// saves (each profile's realm is seeded here). Run: node tools/realm/check-ui-3d.cjs
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), out = path.resolve(root, '../keepfall-3d-qa');
fs.mkdirSync(out, {recursive: true});
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/views/realm.css"></head>
<body><main id="app"><section id="screen" class="screen"></section></main><script type="module">
import * as data from '/js/core/data.js';import * as F from '/js/core/realm.js';import view from '/js/views/realm.js';
await data.load();const profile=new URL(location).searchParams.get('profile')||'evan';data.setGuest(null);data.setMe(profile==='guest'?null:profile);if(profile==='guest')data.setGuest('Keepfall QA Guest');
const el=document.querySelector('#screen');let ctx=null;
function mount(){if(ctx)view.unmount(el,ctx);ctx={visible:true,on:()=>()=>{},timer:()=>()=>{},nav:p=>{window.lastRoute=p},back:()=>{},params:{}};el.innerHTML=view.render();view.mount(el,ctx)}
function seed(level){if(ctx){view.unmount(el,ctx);ctx=null}const bot=F.botBase(level),s=F.fresh();s.rs=F.TEST_RESET;s.b=bot.b.map(b=>({...b,u:0}));s.nb=Math.max(...s.b.map(b=>b.i))+1;s.r={gold:900000,grain:900000};s.sh=Date.now()+86400000;s.ar={footman:20,archer:12,knight:3,thief:4};F._set(s);F.touch();mount();return JSON.stringify(F.mine().b)}
window.qa={F,data,seed,ready:true,snapshot:()=>JSON.stringify(F.mine().b)};
</script></body></html>`;
const stub = `export const LB={raw:[],all:[],ready:false,synced:false,off:true,uid:'local-3d-qa'};export const PNUM={};export const PZ={};export const ensure=async()=>{};export const boardShows=()=>true;export const boardKey=p=>p?.id;export const asGuest=()=>false;`;
const type = {'.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2'};
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://local');
  if (u.pathname === '/') return res.writeHead(200, {'Content-Type': 'text/html'}).end(fixture);
  if (u.pathname === '/js/core/daily.js') return res.writeHead(200, {'Content-Type': 'text/javascript'}).end(stub);
  const file = path.resolve(root, '.' + decodeURIComponent(u.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => {
    if (err) return res.writeHead(404).end();
    // (the opening lore pages are their own check's; the 3D is the real one)
    if (u.pathname === '/js/views/realm.js') bytes = Buffer.from(bytes.toString().replace('if (ctx.visible) { openingLore(st);', 'if (false && ctx.visible) { openingLore(st);'));
    if (u.pathname === '/js/views/realm-3d.js') bytes = Buffer.from(bytes.toString().replace('renderer.render(scene, cam);', 'renderer.render(scene, cam); window.__keepScene = scene;'));
    res.writeHead(200, {'Content-Type': type[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;
  const {chromium} = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const report = [];
  try {
    for (const [profile, w, h] of [['evan', 390, 844], ['evan', 844, 390], ['mason', 390, 844], ['guest', 390, 844]]) {
      const context = await browser.newContext({viewport: {width: w, height: h}, serviceWorkers: 'block'}), page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
      await page.goto(origin + '/?profile=' + profile); await page.waitForFunction(() => window.qa?.ready, {}, {timeout: 60000});
      const tag = `${profile}-${w}x${h}`;
      const before = await page.evaluate(() => qa.seed(7));
      await page.waitForFunction(() => document.querySelector('.rl-gl canvas') && window.__keepScene, {}, {timeout: 90000});
      await page.waitForTimeout(6000);
      await page.screenshot({path: path.join(out, `${tag}-home.png`)});
      const scene = await page.evaluate(() => {
        let pictures = 0, terrain = false, buildings = 0;
        window.__keepScene.traverse(o => { if (o.isSprite && o.visible && o.name !== 'hero-badge') pictures++; if (o.name === 'keep-terrain') terrain = true; if (/^keep-building-/.test(o.name)) buildings++; });
        return {pictures, terrain, buildings};
      });
      assert(scene.terrain && scene.buildings > 20, JSON.stringify(scene));
      assert.equal(scene.pictures, 0, 'no pictures in the 3D world');
      // a building's card: its picture is its 3D model
      const canvas = await page.locator('.rl-gl canvas').boundingBox();
      let card = false;
      for (const [fx, fy] of [[.5, .5], [.47, .47], [.53, .5], [.5, .55], [.45, .52]]) {
        await page.mouse.click(canvas.x + canvas.width * fx, canvas.y + canvas.height * fy);
        await page.waitForTimeout(700);
        if (await page.locator('[data-rl-art] img').count()) { card = true; break; }
      }
      if (card) {
        const src = await page.locator('[data-rl-art] img').first().getAttribute('src');
        assert(src.startsWith('data:image/png'), 'the card shows the 3D render');
        await page.waitForTimeout(400);
        await page.screenshot({path: path.join(out, `${tag}-card.png`)});
        await page.locator('[data-rl-unsel]').first().click().catch(() => {});
      }
      // the shop: every building drawn from its model
      await page.locator('[data-rl-shop]').first().click(); await page.waitForTimeout(1500);
      const shop = await page.evaluate(() => [...document.querySelectorAll('.sheet img')].map(i => i.getAttribute('src') || '').filter(Boolean));
      assert(shop.length >= 10 && shop.every(s => s.startsWith('data:image/png')), 'shop pictures are 3D renders: ' + shop.length);
      await page.screenshot({path: path.join(out, `${tag}-shop.png`)});
      for (let i = 0; i < 3; i++) { const c = page.locator('[data-sheet-close]'); if (!await c.count()) break; await c.last().click({timeout: 3000}).catch(() => {}); await page.waitForTimeout(500); }
      await page.locator('[data-rl-army]').first().click(); await page.waitForTimeout(1500);
      const army = await page.evaluate(() => [...document.querySelectorAll('.sheet img')].map(i => i.getAttribute('src') || '').filter(Boolean));
      await page.screenshot({path: path.join(out, `${tag}-army.png`)});
      const after = await page.evaluate(() => qa.snapshot());
      assert.equal(after, before, 'looking round changes no building');
      assert.deepEqual(errors, [], 'no page errors');
      report.push({tag, scene, card, shop: shop.length, army: army.length});
      console.log('PASS:', tag, JSON.stringify({scene, card, shop: shop.length, army: army.length}));
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Screenshots:', out);
})().catch(e => { console.error(e); process.exitCode = 1; });
