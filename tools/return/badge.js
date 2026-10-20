// Draws Return Man's Daily Games badge, img/return.webp (views/games.js): the returner in navy (the Two-Minute Drill's
// picture of a ball carrier's stiff arm, img/drill/players.webp) racing right, green speed streaks behind him; smooth,
// like the Drill's and Kick It's badges (tools/seventeen/badges.py). Needs the app served at http://localhost:8765
// (python3 -m http.server 8765 from the repo) and Playwright; then bump CACHE in sw.js.
// Run: node tools/return/badge.js
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 600, height: 600 } })).newPage();
  await p.goto('http://localhost:8765/index.html#/league/standings'); await p.waitForTimeout(1500);
  const url = await p.evaluate(async () => {
    const SP = await import('/js/views/drill-sprites.js'); await SP.load();
    const S = 512, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    // the streaks: three green ones and a white one, fading out to the left
    [[150, 64, 30, .9], [222, 92, 24, .75], [300, 70, 20, .6], [186, 40, 12, .55]].forEach(([y, x0, w, a], i) => {
      const gr = g.createLinearGradient(x0, 0, 300, 0);
      const c = i === 3 ? '255,255,255' : '62,240,143';
      gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(1, `rgba(${c},${a})`);
      g.strokeStyle = gr; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y); g.lineTo(290, y); g.stroke();
    });
    // a soft shadow under him
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(292, 478, 120, 22, 0, 0, Math.PI * 2); g.fill();
    SP.draw(g, {f: 'rb.stiff_r', flip: false}, ['#1D3F8F'], true, 290, 476, 430);
    return cv.toDataURL('image/png');
  });
  const out = path.join(__dirname, '..', '..', 'img', 'return.png');
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
  require('child_process').execSync(`python3 -c "from PIL import Image; Image.open('${out}').resize((128, 128), Image.LANCZOS).save('${out.replace(/png$/, 'webp')}', 'WEBP', lossless=True)"`);
  fs.unlinkSync(out);
  console.log('wrote img/return.webp');
})();
