// Keepfall's 3D land (views/realm-world.js): every scenery a terrain of its own with its water, trees and rocks, no
// painting; the lot flat; the country round it lived in (hamlets of six cottages, smoke from their chimneys, fields and
// windmills where crops grow, the ruined keep, watchtowers) with nothing standing inside anything else (Oct 26 2026:
// "They should not overlap unless it is natural looking"); windmills turning, fireflies in the forest, snow on the
// tundra; a retired land drawn as its nearest; switching lands frees the old one; a missing nature model leaves plain
// 3D trees. Isolated: no Firebase, no real saves. Run: node tools/realm/check-world.cjs
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
        let pictures = 0, trees = 0, imported = 0, points = 0;
        scene.traverse(o => {
          if (o.isSprite && o.visible && o.name !== 'hero-badge') pictures++;
          if (o.isInstancedMesh && /keep-nature-/.test(o.parent?.name || '')) { trees += o.count; imported++; }
          if (o.isPoints) points++;
        });
        // the lot is flat: buildings stand at y 0 across it
        let flat = true;
        for (let x = -22; x <= 22; x += 2) for (let z = -22; z <= 22; z += 2) if (Math.abs(w.heightAt(x, z)) > 1e-9) flat = false;
        const hills = Math.max(...[[-120, -120], [-100, -140], [-140, -90]].map(([x, z]) => w.heightAt(x, z)));
        // the village: its places, its pieces, the chimneys' smoke over their cottages
        const sp = w.spots, count = n => (sp[n] || []).length, P = w.places;
        const houses = ['house1', 'house2', 'house3'].flatMap(n => sp[n] || []), smoke = sp.smoke || [];
        const roofs = smoke.every(s => houses.some(h => Math.hypot(h.x - s.x, h.z - s.z) < 1.6 && s.y > h.y + 2));
        out.push({k, theme: w.theme, terrain: !!scene.getObjectByName('keep-terrain'), water: !!scene.getObjectByName('keep-water'), trees, imported, pictures, flat, hills: +hills.toFixed(1),
          sky: !!scene.background?.isTexture, geometries: R.info.memory.geometries, points,
          hamlets: P.filter(p => p.hamlet).length, fields: P.filter(p => p.field).length, mills: P.filter(p => p.mill).length, houses: houses.length,
          crops: count('rye') + count('sunflower'), windmills: count('windmill'), fences: count('fence'), smoke: smoke.length, roofs,
          ruin: count('ruinWall') + count('ruinArch') + count('ruinEnd'), statues: count('statue') + count('statueBroken') + count('statueHead'), watch: count('watchtower'),
          faults: w.faults()});
        if (geometriesAfterFirst == null) geometriesAfterFirst = R.info.memory.geometries;
      }
      v.setTheme('coast'); await settle();
      const back = window.__characterRender.renderer.info.memory.geometries;
      // the windmills' sails turn (a frame later, they've moved)
      let sail = null;
      v.world.group.traverse(o => { if (!sail && o.isInstancedMesh && o.userData.sails) sail = o; });
      const before = sail && [...sail.instanceMatrix.array.slice(0, 16)];
      const moving = v.world.update(10, {}) && v.world.update(11, {});
      const turned = !!sail && [...sail.instanceMatrix.array.slice(0, 16)].some((x, i) => Math.abs(x - before[i]) > 1e-4);
      const retired = ['ocean', 'christmas', 'infernal'].map(Wd.themeOf);
      v.frameWorld(); await settle();
      return {out, keys: Wd.THEME_KEYS, back, first: geometriesAfterFirst, moving, turned, retired};
    });
    await page.screenshot({path: path.join(output, 'world-overview-landscape.png'), timeout: 180000}); // (software-drawn: the woods are thousands of trees)
    for (const l of lands.out) {
      assert.equal(l.theme, l.k, 'each scenery its own land');
      assert(l.terrain && l.sky && l.water, l.k + ': terrain, sky and water');
      assert(l.trees > 50 && l.imported > 0, l.k + ': trees and rocks from their models (' + l.trees + ')');
      assert.equal(l.pictures, 0, l.k + ': no pictures');
      assert(l.flat, l.k + ': the lot is flat');
      assert(l.hills > 8, l.k + ': mountains behind');
      assert.deepEqual(l.faults, [], l.k + ': nothing stands inside anything else');
      assert(l.hamlets >= 2 && l.houses === 6 * l.hamlets, `${l.k}: hamlets of six cottages (${l.hamlets}, ${l.houses})`);
      assert(l.smoke === 3 * l.hamlets && l.roofs, `${l.k}: smoke from every other chimney, over its cottage (${l.smoke})`);
      assert(l.ruin === 11 && l.statues === 5 && l.watch === 4, `${l.k}: the ruined keep and the watchtowers (${l.ruin}, ${l.statues}, ${l.watch})`);
      if (l.k === 'coast' || l.k === 'forest') assert(l.fields >= 2 && l.crops > 400 && l.fences > 40 && l.windmills === l.mills && l.mills >= 1, `${l.k}: fenced fields and windmills (${l.fields}, ${l.crops}, ${l.fences}, ${l.mills})`);
      if (l.k === 'forest' || l.k === 'tundra') assert(l.points >= 1, l.k + ': fireflies or snow');
    }
    assert.equal(lands.out.length, 4, 'four lands');
    assert(lands.moving && lands.turned, 'the windmills turn');
    assert.deepEqual(lands.retired, ['coast', 'tundra', 'desert'], 'a retired land drawn as its nearest');
    assert(lands.back <= lands.first + 6, `switching lands frees the old one (${lands.first} → ${lands.back} geometries)`);
    assert.deepEqual(test.errors, []);
    console.log('PASS: four 3D lands, laid out with room', JSON.stringify(lands.out.map(l => `${l.k}:${l.trees}${l.water ? '+water' : ''} ${l.hamlets} hamlets ${l.fields} fields`)));
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
