// Owner photo rollout: real profile changes, collection/battle rendering, common fallback, and image loading.
// Firebase and external requests stay disabled. Usage: node tools/dynasty/check-owner-photo.cjs [--shots=<dir>]
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
const mime = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2'};
const fixture = '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/views/dynasty.css"><link rel="stylesheet" href="/css/views/dynasty-rivals.css"><link rel="stylesheet" href="/css/views/dynasty-rarity.css"><style>body{height:auto;overflow:auto;background:#edf2f6}main{display:flex;gap:20px;align-items:start;padding:20px}figure{margin:0;flex:none}</style><main class="pk-sheet"></main>';
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  if (name === '/') return res.writeHead(200, {'Content-Type': 'text/html'}).end(fixture);
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => {
    if (err) return res.writeHead(404).end();
    // Expose the existing private renderer only in this isolated fixture, without starting a saved battle.
    if (name === '/js/views/dynasty-battle.js') bytes = Buffer.from(bytes.toString().replace('function faceHTML(', 'export function faceHTML('));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  });
});
async function run(url) {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport: {width: 640, height: 650}, serviceWorkers: 'block', reducedMotion: 'reduce'});
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url);
    const results = await page.evaluate(async () => {
      const data = await import('/js/core/data.js'), D = await import('/js/core/dynasty.js');
      const V = await import('/js/views/dynasty.js'), battle = await import('/js/views/dynasty-battle.js');
      await data.load(); await D.load();
      const cashman = D.CARDS.find(c => c.p === '0035276'), originalHead = cashman.head;
      const photo = 'img/dynasty/owner/0035276-v1.webp';
      const results = [];
      const verify = (condition, label) => { if (!condition) throw Error(label); results.push(label); };
      data.setMe(null); data.setGuest(null);
      const baseline = D.CARDS.map(c => V.cardHTML(c)), baseBattle = battle.faceHTML(cashman.id);
      for (const profile of [{id: 'evan'}, {id: 'mason'}, {id: 'none', guest: 'Ryan Stewart'},
        {id: 'none', guest: 'Evan Appenzeller'}, {id: null}, {id: 'evan'}, {id: 'none', guest: 'Visitor'}]) {
        data.setMe(profile.id); data.setGuest(profile.guest || null);
        const owner = profile.id === 'evan', label = profile.guest || profile.id || 'unselected';
        const card = V.cardHTML(cashman), face = battle.faceHTML(cashman.id);
        verify(card.includes(photo) === owner && face.includes(photo) === owner, label + ': collection and battle photo scope');
        verify(cashman.head === originalHead, label + ': card data stays unchanged');
        verify(D.CARDS.every((c, i) => owner && c.p === cashman.p || V.cardHTML(c) === baseline[i]), label + ': other portraits unchanged');
        if (!owner) verify(face === baseBattle, label + ': original battle portrait');
        else {
          verify(!V.cardHTML({...cashman, r: 'common'}).includes(photo), 'common cards keep headshots');
          verify(V.creditHTML(cashman) === '', 'owner photo carries no unrelated source credit');
        }
      }
      data.setMe('evan');
      document.querySelector('main').innerHTML = [280, 160, 92].map(width => `<figure style="width:${width}px">${V.cardHTML(cashman, {size: width === 280 ? 'l' : 's', tag: false})}</figure>`).join('');
      return results;
    });
    await page.locator('.pk-c-ph').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const dimensions = await page.locator('.pk-c-ph').first().evaluate(image => [image.naturalWidth, image.naturalHeight]);
    assert.deepEqual(dimensions, [600, 660]);
    assert.deepEqual(errors, []);
    if (shots) {
      fs.mkdirSync(shots, {recursive: true});
      await page.locator('main').screenshot({path: path.join(shots, 'cashman-owner.png')});
    }
    console.log(`PASS: ${results.length} owner/profile-switching assertions; decoded 600 x 660 photo at three card sizes.`);
    await context.close();
  } finally { await browser.close(); }
}
server.listen(0, '127.0.0.1', () => run('http://127.0.0.1:' + server.address().port).then(() => server.close(), error => {
  console.error(error); server.close(); process.exitCode = 1;
}));
