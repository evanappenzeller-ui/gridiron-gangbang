// Isolated real renderer checks for every building kind in 3D (the full 3D Keepfall, Oct 25 2026). No remote service or
// real player save access. Run: node tools/realm/check-buildings-browser.cjs [--fallback-only]
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
          const variants = [], materials = new Set(), stages = {}, original = F.fresh();
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
          // every building kind the game has (but walls: realm-walls.js) at every level it has
          const kinds = F.ORDER.filter(k => k !== 'wall');
          if (kinds.some(k => !B.KINDS.includes(k))) throw Error('A building kind has no 3D model family');
          for (const kind of kinds) for (let level = 1; level <= F.maxLevel(kind); level++) {
            const m = B.create(kind, level, F.KINDS[kind].size);
            if (!m) throw Error('Missing ' + kind + ' level ' + level);
            const box = new T.Box3().setFromObject(m), size = box.getSize(new T.Vector3());
            if (size.x > F.KINDS[kind].size + 1e-6 || size.z > F.KINDS[kind].size + 1e-6) throw Error('Footprint grew: ' + kind);
            if (kind !== 'keep' && kind !== 'hut' && m.getObjectByName('building-rank').count !== level) throw Error('Level lost: ' + kind);
            if (kind === 'tower' && !(m.userData.platformY > 0 && m.userData.platformY < m.userData.height)) throw Error('Invalid archer floor');
            if (kind === 'ballista' || kind === 'cannon') {
              if (!B.animateDefense(m, .15, .4)) throw Error('Missing aiming turret: ' + kind);
            }
            let sprites = 0;
            m.traverse(o => {
              if (o.isSprite) sprites++;
              if (o.isMesh && !o.isInstancedMesh) for (const mat of [o.material].flat()) {
                if (mat.map && !mat.map.image) throw Error('Texture missing: ' + kind); materials.add(mat);
              }
            });
            if (sprites) throw Error('A picture in a 3D building: ' + kind);
            (stages[kind] ||= new Set()).add(m.userData.stage);
            variants.push([kind, level, m.userData.stage]);
            m.userData.owned.forEach(o => {o.geometry.dispose();o.material.dispose();o.dispose();});
          }
          await qa.village();
          const baseBefore = JSON.stringify(qa.base);
          qa.view.setLot(qa.base); qa.view.frameVillage();
          if (JSON.stringify(qa.base) !== baseBefore) throw Error('Rendering mutated the base');
          if (localStorage.getItem(key) !== serialized || JSON.stringify(original) !== serialized) throw Error('Existing progress changed');
          return {variants: variants.length, kinds: kinds.length, sharedMaterials: materials.size, stages: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, v.size])), progressUnchanged: true};
        }, profile);
        assert.equal(result.kinds, 14);
        assert.equal(result.variants, 121, 'every level of every kind');
        assert(Object.entries(result.stages).every(([k, n]) => n === (k === 'hut' ? 1 : 3)), 'three stages a kind (the hut one)');
        await page.waitForTimeout(800);
        const village = await page.evaluate(() => {
          const {groups, scene} = window.__characterRender;
          let pictures = 0;
          scene.traverse(o => { if (o.isSprite && o.name !== 'hero-badge' && o.visible) pictures++; });
          return {buildings: [...groups.values()].map(e => ({kind: e.b.t, imported: !!e.g.userData.importedBuilding})), pictures,
            terrain: !!scene.getObjectByName('keep-terrain'), painted: !!scene.getObjectByProperty('isSprite', true) && pictures > 0};
        });
        assert(village.buildings.length > 0 && village.buildings.every(b => b.imported), 'every building on the lot drawn from its model');
        assert.equal(village.pictures, 0, 'no pictures in the 3D world');
        assert(village.terrain, 'the land is terrain');
        if (profile === 'evan') {
          await page.evaluate(() => qa.view.look(24, 26, 22)); await page.waitForTimeout(400);
          await page.screenshot({path: path.join(output, 'village-mobile.png')});
          await page.setViewportSize({width: 1500, height: 1100});
          await page.evaluate(async () => {
            qa.view.dispose();
            const B = await import('/js/views/realm-buildings.js'), {T, F} = qa;
            const host = document.querySelector('#host'); host.innerHTML = '';
            const scene = new T.Scene(); scene.background = new T.Color(0x263933);
            scene.add(new T.HemisphereLight(0xffffff, 0x6c6b56, 2.2));
            const light = new T.DirectionalLight(0xffedd2, 2.6); light.position.set(-8, 18, 12); scene.add(light);
            const camera = new T.OrthographicCamera(-22, 22, 16, -16, .1, 200);
            camera.position.set(30, 34, 30); camera.lookAt(0, 0, 0);
            const renderer = new T.WebGLRenderer({antialias: true}); renderer.setSize(1500, 1100); renderer.setPixelRatio(1);
            renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
            host.appendChild(renderer.domElement);
            const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({color: 0x405745, roughness: 1}));
            floor.rotation.x = -Math.PI / 2; floor.position.y = -.03; scene.add(floor);
            F.ORDER.filter(k => k !== 'wall').forEach((kind, row) => [1, Math.ceil(F.maxLevel(kind) / 2), F.maxLevel(kind)].forEach((level, col) => {
              const m = B.create(kind, level, F.KINDS[kind].size); m.position.set((col - 1) * 5.5 + (row % 2) * 17 - 8, 0, (Math.floor(row / 2) - 3) * 5.2); scene.add(m);
            }));
            renderer.render(scene, camera);
            document.querySelector('#label').textContent = 'Every Keepfall building in 3D · each kind at its first, middle and top level';
            window.gallery = {renderer, scene};
          });
          await page.screenshot({path: path.join(output, 'imported-buildings.png')});
        }
        assert.deepEqual(test.errors, []); console.log('PASS:', profile, JSON.stringify(result));
      } finally { await test.context.close(); }
    }
    const test = await isolated(browser, url);
    try {
      // A missing model must leave the building standing in plain 3D, selectable; never a picture.
      await test.page.route(/\/models\/realm\/(buildings-v1|world-v1)\/.*\.glb$/, route => route.fulfill({status: 404, body: 'Intentional failure'}));
      await test.page.reload(); await test.page.waitForFunction(() => qa.ready);
      await test.page.evaluate(() => qa.village()); await test.page.waitForTimeout(500);
      const fallback = await test.page.evaluate(() => {
        let pictures = 0; window.__characterRender.scene.traverse(o => { if (o.isSprite && o.name !== 'hero-badge' && o.visible) pictures++; });
        return {pictures, groups: [...window.__characterRender.groups.values()].map(e => ({imported: !!e.g.userData.importedBuilding, meshes: (() => { let n = 0; e.g.traverse(o => { if (o.isMesh) n++; }); return n; })()}))};
      });
      assert(fallback.groups.length > 1 && fallback.groups.every(e => !e.imported && e.meshes > 0), 'plain 3D buildings stand in');
      assert.equal(fallback.pictures, 0, 'no picture fallback');
      assert.deepEqual(test.errors, []); console.log('PASS: failed models fall back to plain 3D buildings, selectable');
      await test.page.unroute(/\/models\/realm\/(buildings-v1|world-v1)\/.*\.glb$/);
      await test.page.route(/\/models\/realm\/(buildings-v1|world-v1)\/.*\.(png|jpg)$/, route => route.fulfill({status: 404, body: 'Intentional missing texture'}));
      await test.page.reload(); await test.page.waitForFunction(() => qa.ready);
      await test.page.evaluate(() => qa.village()); await test.page.waitForTimeout(500);
      assert.equal(await test.page.evaluate(() => [...window.__characterRender.groups.values()].some(e => e.g.userData.importedBuilding)), false, 'Missing textures fall back to plain 3D, not white models');
      assert.deepEqual(test.errors, []); console.log('PASS: missing textures fall back to plain 3D buildings instead of white models');
    } finally { await test.context.close(); }
  } finally { await browser.close(); await new Promise(resolve => local.close(resolve)); }
  console.log('Screenshots:', output);
})().catch(e => { console.error(e); process.exitCode = 1; });
