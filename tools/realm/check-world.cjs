// Keepfall's 3D land (views/realm-world.js): every scenery a terrain of its own with its water, trees and rocks, no
// painting; the lot flat; switching lands frees the old one; a missing nature model leaves plain 3D trees. Isolated:
// no Firebase, no real saves. Run: node tools/realm/check-world.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {server, isolated, playwright} = require('./check-characters-browser.cjs');
const output = path.resolve(__dirname, '../../../keepfall-3d-qa');
(async () => {
  fs.mkdirSync(output, {recursive: true});
  const local = await server(), url = 'http://127.0.0.1:' + local.address().port;
  const browser = await playwright().chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    const test = await isolated(browser, url, {width: 844, height: 390}), {page} = test;
    const lands = await page.evaluate(async () => {
      const {F, D3} = qa, Wd = await import('/js/views/realm-world.js'), out = [];
      const v = D3.create(document.querySelector('#host'), {village: true, scenery: 'coast', isActive: () => true});
      v.setLot(F.botBase(5)); qa.view = v;
      const settle = () => new Promise(r => setTimeout(r, 2500));
      await settle();
      let geometriesAfterFirst = null;
      for (const k of F.SCENERIES.map(x => x.k)) {
        v.setTheme(k); await settle();
        const w = v.world, scene = window.__characterRender.scene, R = window.__characterRender.renderer;
        let pictures = 0, trees = 0, imported = 0;
        scene.traverse(o => {
          if (o.isSprite && o.visible && o.name !== 'hero-badge') pictures++;
          if (o.isInstancedMesh && /keep-nature-/.test(o.parent?.name || '')) { trees += o.count; imported++; }
        });
        // the lot is flat: buildings stand at y 0 across it
        let flat = true;
        for (let x = -22; x <= 22; x += 2) for (let z = -22; z <= 22; z += 2) if (Math.abs(w.heightAt(x, z)) > 1e-9) flat = false;
        const hills = Math.max(...[[-120, -120], [-100, -140], [-140, -90]].map(([x, z]) => w.heightAt(x, z)));
        out.push({k, theme: w.theme, terrain: !!scene.getObjectByName('keep-terrain'), water: !!scene.getObjectByName('keep-water'), trees, imported, pictures, flat, hills: +hills.toFixed(1),
          sky: !!scene.background?.isTexture, geometries: R.info.memory.geometries});
        if (geometriesAfterFirst == null) geometriesAfterFirst = R.info.memory.geometries;
      }
      v.setTheme('coast'); await settle();
      const back = window.__characterRender.renderer.info.memory.geometries;
      v.frameWorld(); await settle();
      return {out, keys: Wd.THEME_KEYS, back, first: geometriesAfterFirst};
    });
    await page.screenshot({path: path.join(output, 'world-overview-landscape.png')});
    for (const l of lands.out) {
      assert.equal(l.theme, l.k, 'each scenery its own land');
      assert(l.terrain && l.sky, l.k + ': terrain and sky');
      assert(l.trees > 50 && l.imported > 0, l.k + ': trees and rocks from their models (' + l.trees + ')');
      assert.equal(l.pictures, 0, l.k + ': no pictures');
      assert(l.flat, l.k + ': the lot is flat');
      if (l.k !== 'ocean') assert(l.hills > 8, l.k + ': mountains behind'); // (the ocean's an island: sea all round)
    }
    assert(lands.out.filter(l => l.water).length >= 6, 'sea, river, island, ice, oasis and lava');
    assert(lands.back <= lands.first + 6, `switching lands frees the old one (${lands.first} → ${lands.back} geometries)`);
    assert.deepEqual(test.errors, []);
    console.log('PASS: seven 3D lands', JSON.stringify(lands.out.map(l => `${l.k}:${l.trees}${l.water ? '+water' : ''}`)));
    await test.context.close();
    // a missing nature model: the land stays, plain 3D trees and rocks stand in
    const fail = await isolated(browser, url, {width: 390, height: 844});
    await fail.context.route('**/models/realm/world-v1/nature.glb', r => r.fulfill({status: 404, body: 'Intentional failure'}));
    await fail.page.reload(); await fail.page.waitForFunction(() => qa.ready);
    const plain = await fail.page.evaluate(async () => {
      const v = qa.D3.create(document.querySelector('#host'), {village: true, scenery: 'forest', isActive: () => true});
      v.setLot(qa.F.botBase(3)); await new Promise(r => setTimeout(r, 2500));
      let cones = 0, pictures = 0;
      window.__characterRender.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.type === 'ConeGeometry') cones += o.count; if (o.isSprite && o.visible && o.name !== 'hero-badge') pictures++; });
      v.dispose(); return {cones, pictures};
    });
    assert(plain.cones > 50 && plain.pictures === 0, JSON.stringify(plain));
    assert.deepEqual(fail.errors, []);
    console.log('PASS: a missing nature model leaves plain 3D trees', JSON.stringify(plain));
    await fail.context.close();
  } finally { await browser.close(); await new Promise(resolve => local.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
