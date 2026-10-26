// Isolated real renderer checks. No remote service or real player save access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {server, isolated, playwright} = require('./check-characters-browser.cjs');
const output = path.resolve(__dirname, '../../../building-qa-release');
(async () => {
  fs.mkdirSync(output, {recursive: true});
  const local = await server(), url = 'http://127.0.0.1:' + local.address().port;
  const browser = await playwright().chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    for (const profile of process.argv.includes('--fallback-only') ? [] : ['evan', 'mason', 'none']) {
      const test = await isolated(browser, url, {profile}), {page} = test;
      try {
        const result = await page.evaluate(async profile => {
          const B = await import('/js/views/realm-buildings.js');
          const {T, F} = qa;
          const variants = [], materials = new Set(), original = F.fresh();
          // Representative existing progress is carried through rendering as-is.
          original.b[0].l = 7; original.r = {gold: 4321, grain: 8765};
          original.ar = {footman: 41, archer: 22, knight: 7}; original.hr = {knight: 4};
          original.q = [['archer', 3]]; original.qs = Date.now();
          original.rd = [{id: 'saved-raid', rules: 3, trophy: 18}]; original.tp = 154; original.rs = F.TEST_RESET;
          ['nightmare', 'soul-eater', 'terror-bringer', 'usurper'].forEach((species, i) => {
            original.b.push({i: 20 + i, t: 'hatchery', l: i + 1, x: 3 + i * 7, y: 4, u: 0, dragon: {species, color: 'blue'}});
          });
          const serialized = JSON.stringify(original), key = 'gg-v3-fr1-' + (profile === 'none' ? 'g_qa' : 'm_' + profile);
          localStorage.setItem(key, serialized);
          for (const kind of B.KINDS) for (let level = 1; level <= 10; level++) {
            const m = B.create(kind, level, F.KINDS[kind].size);
            if (!m) throw Error('Missing ' + kind + ' level ' + level);
            const box = new T.Box3().setFromObject(m), size = box.getSize(new T.Vector3());
            if (size.x > F.KINDS[kind].size || size.z > F.KINDS[kind].size) throw Error('Footprint grew');
            if (m.getObjectByName('building-rank').count !== level) throw Error('Level lost');
            if (kind === 'tower' && !(m.userData.platformY > 0 && m.userData.platformY < m.userData.height)) throw Error('Invalid archer floor');
            if (kind === 'ballista') {
              if (!B.animateDefense(m, .15, .4)) throw Error('Missing aiming turret');
              const base = m.getObjectByName('td_humans_base' + m.userData.stage);
              if (new T.Box3().setFromObject(base).max.y < m.userData.height * .7) throw Error('Weapon part displaced from tower');
            }
            m.traverse(o => { if (o.isMesh && !o.isInstancedMesh) for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
              if (!mat.map?.image) throw Error('Texture missing'); materials.add(mat);
            }});
            variants.push([kind, level, m.userData.stage]);
            m.userData.owned.forEach(o => {o.geometry.dispose();o.material.dispose();o.dispose();});
          }
          await qa.village();
          const baseBefore = JSON.stringify(qa.base);
          qa.view.setLot(qa.base); qa.view.frameVillage();
          if (JSON.stringify(qa.base) !== baseBefore) throw Error('Rendering mutated the base');
          if (localStorage.getItem(key) !== serialized || JSON.stringify(original) !== serialized) throw Error('Existing progress changed');
          return {variants: variants.length, sharedMaterials: materials.size, progressUnchanged: true};
        }, profile);
        assert.equal(result.variants, 30); assert.equal(result.sharedMaterials, 2);
        await page.waitForTimeout(500);
        const village = await page.evaluate(() => {
          const {groups} = window.__characterRender;
          return [...groups.values()].filter(e => e.g.userData.importedBuilding).map(e => ({kind: e.b.t, id: e.b.i, platform: e.g.userData.platformY}));
        });
        assert(village.some(b => b.kind === 'tower') && village.some(b => b.kind === 'ballista'));
        if (profile === 'evan') {
          await page.evaluate(() => qa.view.look(24, 26, 22)); await page.waitForTimeout(250);
          await page.screenshot({path: path.join(output, 'village-mobile.png')});
          await page.setViewportSize({width: 1200, height: 900});
          await page.evaluate(async () => {
            qa.view.dispose();
            const B = await import('/js/views/realm-buildings.js'), {T, F} = qa;
            const host = document.querySelector('#host'); host.innerHTML = '';
            const scene = new T.Scene(); scene.background = new T.Color(0x263933);
            scene.add(new T.HemisphereLight(0xffffff, 0x6c6b56, 2.6));
            const light = new T.DirectionalLight(0xffedd2, 3); light.position.set(-8, 18, 12); scene.add(light);
            const camera = new T.OrthographicCamera(-10.5, 10.5, 7.9, -7.9, .1, 100);
            camera.position.set(11, 17, 20); camera.lookAt(0, 0, 0);
            const renderer = new T.WebGLRenderer({antialias: true}); renderer.setSize(1200, 900); renderer.setPixelRatio(1);
            host.appendChild(renderer.domElement);
            const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({color: 0x405745, roughness: 1}));
            floor.rotation.x = -Math.PI / 2; floor.position.y = -.03; scene.add(floor);
            B.KINDS.forEach((kind, row) => [1, 4, 8].forEach((level, col) => {
              const m = B.create(kind, level, F.KINDS[kind].size); m.position.set((col - 1) * 5, 0, (row - 1) * 5); scene.add(m);
            }));
            renderer.render(scene, camera);
            document.querySelector('#label').textContent = 'Actual imported models · rows: barracks / towers / ballistas · stages 1 / 2 / 3';
            window.gallery = {renderer, scene};
          });
          await page.screenshot({path: path.join(output, 'imported-buildings.png')});
        }
        assert.deepEqual(test.errors, []); console.log('PASS:', profile, result);
      } finally { await test.context.close(); }
    }
    const test = await isolated(browser, url);
    try {
      // A missing GLB must retain the existing building and remain selectable.
      await test.page.route('**/models/realm/buildings-v1/**', route => route.fulfill({status: 404, body: 'Intentional failure'}));
      await test.page.reload(); await test.page.waitForFunction(() => qa.ready);
      await test.page.evaluate(() => qa.village()); await test.page.waitForTimeout(300);
      const fallback = await test.page.evaluate(() => [...window.__characterRender.groups.values()].filter(e => ['tower','ballista'].includes(e.b.t)).map(e => ({imported: !!e.g.userData.importedBuilding, pickable: e.g.children.length > 0})));
      assert(fallback.length === 2 && fallback.every(e => !e.imported && e.pickable));
      assert.deepEqual(test.errors, []); console.log('PASS: failed imports retain original building artwork');
      await test.page.unroute('**/models/realm/buildings-v1/**');
      await test.page.route('**/models/realm/buildings-v1/*.png', route => route.fulfill({status: 404, body: 'Intentional missing texture'}));
      await test.page.reload(); await test.page.waitForFunction(() => qa.ready);
      await test.page.evaluate(() => qa.village()); await test.page.waitForTimeout(300);
      assert.equal(await test.page.evaluate(() => [...window.__characterRender.groups.values()].some(e => e.g.userData.importedBuilding)), false, 'Missing textures retain complete original artwork');
      assert.deepEqual(test.errors, []); console.log('PASS: missing textures retain original artwork instead of white models');
    } finally { await test.context.close(); }
  } finally { await browser.close(); await new Promise(resolve => local.close(resolve)); }
  console.log('Screenshots:', output);
})().catch(e => { console.error(e); process.exitCode = 1; });
