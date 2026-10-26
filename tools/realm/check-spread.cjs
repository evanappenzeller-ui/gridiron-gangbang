// Raid soldiers are drawn apart where the battle stacks them (the owner, Oct 25 2026: "Ensure they remain spread out and
// don't pile up on top of each other"), and the battle itself is untouched. Isolated: no Firebase, no real saves.
// Run: node tools/realm/check-spread.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {server, isolated, playwright} = require('./check-characters-browser.cjs');
const output = path.resolve(__dirname, '../../../character-qa-release');
(async () => {
  fs.mkdirSync(output, {recursive: true});
  const local = await server(), url = 'http://127.0.0.1:' + local.address().port;
  const browser = await playwright().chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    const test = await isolated(browser, url, {width: 390, height: 844}), {page} = test;
    const measure = await page.evaluate(async () => {
      const {F, D3} = qa, {makeBattle, replay} = await import('/js/core/realm-battle.js');
      const base = F.botBase(4), army = {footman: 30, knight: 6, archer: 10, thief: 4};
      const B = makeBattle(base, null, army);
      const view = D3.create(document.querySelector('#host'), {isActive: () => true});
      view.setLot(base); view.look(4, 4, 18); view.raidStart(B, {pri: 0x7a1f2b, sec: 0xd4a63a, sigil: 'crown'});
      // everyone dropped on the very same spot
      const drops = [];
      for (const [k, n] of Object.entries(army)) for (let i = 0; i < n; i++) { if (!B.deploy(k, 3.2, 3.2)) throw Error('drop'); drops.push([k, 3.2, 3.2]); }
      const raidOf = () => window.__characterRender.raid;
      const drawn = () => {
        const out = [];
        // (the living: one falling may lie by another)
        Object.values(raidOf().meshes).forEach(M => M.characters && M.characters.forEach(a => { if (a.model.root.visible && a.death == null) out.push([a.model.root.position.x, a.model.root.position.z]); }));
        return out;
      };
      const closest = pts => { let m = Infinity; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])); return m; };
      const simClosest = () => closest(B.tr.filter(u => !u.dead && !u.hero).map(u => [u.x, u.y]));
      const samples = [];
      for (let t = .1; t <= 3.01; t += .1) {
        B.run(t); view.raidFrame(t); view.want();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (t > .55) samples.push({t, drawn: closest(drawn()), sim: simClosest(), n: drawn().length});
      }
      const offsets = [];
      B.tr.forEach(u => { const o = raidOf().spread.get(u); if (o) offsets.push(Math.hypot(o.x, o.y)); });
      // the battle and its replay agree exactly: drawing apart changed nothing in it
      B.run(Infinity);
      const a = JSON.stringify(B.result()), b = JSON.stringify(replay(base, null, army, B.result().drops, Infinity).result());
      return {samples, maxOffset: Math.max(...offsets), deterministic: a === b};
    });
    await page.screenshot({path: path.join(output, 'raid-spread.png')});
    const worstDrawn = Math.min(...measure.samples.map(s => s.drawn)), worstSim = Math.min(...measure.samples.map(s => s.sim));
    assert(worstSim < .05, 'the battle stacks them (the case this guards)');
    assert(worstDrawn > .38, `drawn soldiers stand apart (closest ${worstDrawn.toFixed(3)} tiles)`);
    assert(measure.maxOffset <= 2.6001, 'never drawn far from where the battle has him');
    assert.equal(measure.deterministic, true, 'battle outcome and replay unchanged');
    assert.deepEqual(test.errors, []);
    console.log('PASS: stacked soldiers drawn apart', JSON.stringify({closestDrawn: +worstDrawn.toFixed(3), closestInBattle: +worstSim.toFixed(3), maxOffset: +measure.maxOffset.toFixed(3), units: measure.samples.at(-1).n}));
    await test.context.close();
  } finally { await browser.close(); await new Promise(resolve => local.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
