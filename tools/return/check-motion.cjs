#!/usr/bin/env node
// Offline gameplay, scope and mobile render checks; never posts a score.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'output/return-motion');
const baseline = process.env.RETURN_MOTION_BASELINE || 'c90656a';
const origin = 'http://127.0.0.1:8765';
let playwright;
try { playwright = require('playwright'); } catch (_) { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const mime = {'.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2'};
async function main() {
  fs.mkdirSync(output, {recursive: true});
  const browser = await playwright.chromium.launch({channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader']});
  const errors = [], external = [], report = {};
  try {
    const context = await browser.newContext({viewport: {width: 430, height: 820}, serviceWorkers: 'block'});
    const page = await context.newPage();
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.href); return route.abort(); }
      if (url.pathname === '/check') return route.fulfill({contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/views/return.css"><style>body{margin:0;background:#112333;font-family:system-ui;color:white}.rm-pane{width:430px}.rm-stage{height:820px!important;max-height:none!important}</style><main class="rm-pane"></main>'});
      if (url.pathname === '/js/app.js') return route.fulfill({contentType: 'text/javascript', body: 'export const APP_VERSION="offline-check", installEvent=null; export async function promptInstall(){return false;}'});
      try {
        let body;
        if (url.pathname === '/js/core/return-baseline.js') body = execFileSync('git', ['show', `${baseline}:js/core/return.js`], {cwd: root});
        else {
          const file = path.resolve(root, '.' + decodeURIComponent(url.pathname)), rel = path.relative(root, file);
          assert(!rel.startsWith('..') && !path.isAbsolute(rel));
          body = fs.readFileSync(file);
          if (url.pathname === '/js/views/return.js') body += '\nexport {runner3, runnerAnim, chaser3, chaserAt, draw, patchHud, frame, onEvents};';
          if (url.pathname === '/js/views/return-3d.js') body += '\nexport {GL};';
          if (url.pathname === '/js/views/return-3dworld.js') body += '\nexport {LIVE};';
        }
        return route.fulfill({contentType: mime[path.extname(url.pathname)] || 'application/octet-stream', body});
      } catch (e) { errors.push(e.message); return route.fulfill({status: 404, body: e.message}); }
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { window.requestIdleCallback = () => 1; window.cancelIdleCallback = () => {}; });
    await page.goto(origin + '/check');
    report.gameplay = await page.evaluate(async () => {
      const [D, R, old, V, D3] = await Promise.all([import('/js/core/data.js'), import('/js/core/return.js'), import('/js/core/return-baseline.js'), import('/js/views/return.js'), import('/js/views/return-3d.js')]);
      await D.load();
      window.qa = {D, R, V, D3};
      const results = [], ok = (b, s) => { if (!b) throw new Error(s); }, eq = (a, b, s) => ok(JSON.stringify(a) === JSON.stringify(b), s);
      const test = (name, fn) => { fn(); results.push(name); };
      const tick = (r, seconds, dt = 1 / 60) => { const e = []; for (let t = 0; t < seconds - 1e-7 && !r.over; t += dt) e.push(...R.step(r, dt)); return e; };
      function empty(profile = 'evan') {
        D.setMe(profile); const r = R.startRun(70001, 0, true, false, true);
        r.co = {...r.co, rows: [], sets: [], items: [], traffic: [], z: 1e9, done: 1e9}; r.t = 10;
        return r;
      }
      function train(r, lane = 1, d = 1) {
        const p = {i: 'test', lane, kind: 'express', z0: r.z + d, z1: r.z + d + R.TRAFFIC.length, h: R.TRAFFIC.height, b: 0, ramp: 0, hi: true};
        r.trains.push(p); return p;
      }
      function pickup(r) { r.co.items = [{i: 0, kind: 'jetpack', lane: 1, z: r.z + .01}]; return tick(r, .02); }
      test('Every profile receives the deployed owner course, movement and power-ups', () => {
        D.setMe('evan');
        const courses = [1, 16, 500].map(n => JSON.stringify(old.fill(old.course(n, 0, true, true), 3000)));
        const b = old.startRun(12, 0, true, false, true), frames = [];
        for (let i = 0; i < 300; i++) {
          if (i % 40 === 0) old.move(b, 'up');
          frames.push({events: JSON.stringify(old.step(b, 1 / 60)), motion: [b.z, b.y, b.steps, b.yards, b.over]});
        }
        for (const profile of ['evan', 'ben', 'Ryan Stewart', 'Evan Appenzeller', 'Guest Runner', null]) {
          D.setMe(profile === 'evan' || profile === 'ben' ? profile : 'none'); D.setGuest(['evan', 'ben'].includes(profile) ? null : profile);
          for (const [index, n] of [1, 16, 500].entries()) {
            const a = R.fill(R.course(n, 0, true, true), 3000);
            ok(a.enhanced && a.traffic.length && a.items.some(i => i.kind === 'jetpack'), 'complete course for ' + profile);
            ok(JSON.stringify(a) === courses[index], 'same complete owner course for ' + profile);
          }
          const a = R.startRun(12, 0, true, false, true);
          for (let i = 0; i < 300; i++) {
            if (i % 40 === 0) R.move(a, 'up');
            ok(JSON.stringify(R.step(a, 1 / 60)) === frames[i].events, 'same events for ' + profile);
            eq([a.z, a.y, a.steps, a.yards, a.over], frames[i].motion, 'same motion for ' + profile);
          }
          for (const kind of ['salts', 'pills', 'booze', 'jetpack']) {
            const r = R.startRun(70011, 0, true, false, true);
            r.co = {...r.co, rows: [], sets: [], traffic: [], items: [{i: 0, kind, lane: 1, z: .01}], z: 1e9, done: 1e9};
            ok(tick(r, .02).some(e => e.type === 'pickup'), kind + ' pickup for ' + profile);
            ok(R.multiplierOf(r) === 2, kind + ' double points for ' + profile);
            if (kind === 'jetpack') ok(R.flying(r) && r.sky.coins.length && r.sky.hazards.length && R.move(r, 'right'), 'flight, coins, hazards and steering for ' + profile);
          }
        }
      });
      D.setGuest(null); D.setMe('evan');
      test('Owner stride covers more ground per cycle and remains capped under salts', () => {
        const a = empty(), b = empty(); b.co.enhanced = false; a.burst = b.burst = 10;
        tick(a, 1); tick(b, 1); ok(a.z === b.z && Math.abs(a.yards - b.yards * 2) < .001, 'same forward speed, owner salts give double points');
        ok(a.steps < b.steps * .7 && R.strideRate(100) === 10.5, 'slower legs and bounded cadence');
        const st = {run: a, mode: 'run'}; a.steps = 1.25;
        ok(V.runner3(st, 10000).lift > .16, 'springy visible lift');
      });
      test('Train corridors always leave an open lane and have no stationary blockers', () => {
        for (let n = 1; n <= 30; n++) {
          const c = R.fill(R.course(n, 0, true, true), 6000);
          ok(c.traffic.length > 8, 'repeated incoming encounters');
          ok(c.items[0].kind === 'jetpack', 'early jetpack');
          for (const p of c.items.filter(p => p.kind === 'jetpack')) ok(!p.top && R.groundAt(c, p.lane, p.z) === 0, 'jetpacks reachable on the road');
          for (const t of c.traffic) {
            ok(t.lanes.length < 3, 'escape lane');
            ok(!c.rows.some(r => r.z >= t.trigger && r.z < t.trigger + 107.99), 'no rows inside encounter');
            ok(!c.sets.some(s => s.ze > t.trigger && s.zs < t.trigger + 107.99), 'no parked vehicles inside encounter');
          }
        }
      });
      test('Incoming trains advance, crash head-on, and can be dodged', () => {
        const a = empty(); const p = train(a, 1, 5), start = p.z0; tick(a, .1); ok(p.z0 < start, 'object travels toward player');
        const events = tick(a, 1); ok(a.over && events.some(e => e.type === 'crashed'), 'head-on crash');
        const b = empty(); train(b, 1, 12); R.move(b, 'left'); tick(b, 2); ok(!b.over && b.lane === 0, 'lane dodge');
        const c = empty(); train(c, 0, -2); ok(!R.move(c, 'left'), 'cannot juke through train side');
        c.salts = 1; c.burst = 10; tick(c, .02); ok(!c.over, 'existing side-hit revival rules while salts are active');
      });
      test('Trains respect pills and salts without repeated impacts', () => {
        const a = empty(); train(a); a.salts = 1; a.burst = 10; const ev = tick(a, 2);
        ok(!a.over && a.salts === 0 && ev.filter(e => e.type === 'revived').length === 1, 'one salts revival for one train');
        const b = empty(); train(b); b.pills = 6; tick(b, 2); ok(!b.over && b.hits === 0, 'painkillers protect');
      });
      test('Jetpack pickup, ascent, steering, collision protection and safe expiry', () => {
        const a = empty(); ok(pickup(a).some(e => e.type === 'pickup'), 'collected');
        a.sky = null; // This case isolates ground clearance; sky dodging has its own checks below.
        tick(a, 1); ok(a.y > 6 && R.flying(a), 'above all obstacles');
        const spec = V.runner3({run: a, mode: 'run'}, 10000); ok(spec.jetpack && spec.move === 'idle', 'flying pose');
        ok(!R.move(a, 'down') && !R.move(a, 'up'), 'vertical swipes cannot cancel flight');
        ok(R.move(a, 'right'), 'steering'); tick(a, .2); ok(a.lane === 2, 'changed lane');
        train(a, 2); tick(a, 2); ok(!a.over && a.y > 6, 'clears train');
        const phase = a.steps; tick(a, .5); ok(a.steps === phase, 'legs stop cycling in flight');
        const events = tick(a, 4.4); ok(!a.over && a.jetpack === 0 && a.y < .02 && events.some(e => e.type === 'jetlanded'), 'safe automatic landing');
        ok(a.landing > 0, 'short landing buffer'); tick(a, 1); train(a, 2); tick(a, 1); ok(a.over, 'protection expires');
      });
      test('Flight handles simultaneous booze, salts and landing on a roof', () => {
        const a = empty(); a.booze = 8; a.burst = 10; pickup(a); a.sky = null; tick(a, 6.8);
        const z = a.z; a.co.sets = [{i: 0, zs: z, ze: z + 100, plats: [{lane: 1, kind: 'teambus', z0: z, z1: z + 100, h: 3, b: 0, ramp: 0, hi: true}]}];
        tick(a, 1.2); ok(!a.over && Math.abs(a.y - 3) < .05 && a.yards > a.z, 'roof landing and double yards');
      });
      test('Traffic state belongs to each run and simulation is frame-rate independent', () => {
        const a = empty(), b = empty(); a.co.traffic = b.co.traffic = [{i: 0, trigger: 0, lanes: [0]}];
        tick(a, 2, 1 / 30); tick(b, 2, 1 / 120);
        ok(Math.abs(a.z - b.z) < .001 && Math.abs(a.trains[0].z0 - b.trains[0].z0) < .001, 'equal time equal movement');
        ok(a.trains[0] !== b.trains[0], 'independent train objects');
        const before = JSON.stringify(a); R.step(a, 0); eq(JSON.stringify(a), before, 'paused state does not advance');
      });
      test('Changing profile keeps shared flight available', () => {
        const a = empty(); pickup(a); D.setMe('ben'); R.step(a, .1); ok(!a.over && R.flying(a), 'flight stays available on another member'); D.setMe('evan');
      });
      test('Every jetpack supplies a fresh solvable sky course and coins, including repeat runs', () => {
        for (let n = 0; n < 20; n++) {
          const r = empty(); r.n += n; pickup(r);
          ok(!r.coins && r.sky.coins.length >= 16 && r.sky.hazards.length >= 4, 'air coins independent of ground reward eligibility');
          const positions = [...new Set(r.sky.hazards.map(h => h.z))];
          for (const z of positions) {
            const blocked = r.sky.hazards.filter(h => h.z === z).map(h => h.lane);
            ok(blocked.length < 3, 'always an open lane');
            ok(r.sky.coins.some(c => Math.abs(c.z - z) < 3 && !blocked.includes(c.lane)), 'coins point through the gap');
          }
          tick(r, 1.5); ok(r.airC > 0 && r.c === r.airC, 'coins collect on repeat runs');
          const serial = r.sky.serial, first = r.sky.coins[0].i;
          r.nextItem = 0; r.jetpack = 0; r.y = 0; r.vy = 0; pickup(r); ok(r.sky.serial > serial && r.sky.coins[0].i !== first, 'new coin IDs every pickup');
        }
      });
      test('Barrel rolls rotate once per lane with continuous rapid steering and a prone pose', () => {
        const r = empty(); pickup(r); tick(r, 1); R.move(r, 'right'); tick(r, R.AIR.roll / 2, .005);
        ok(Math.abs(R.airRollOf(r) - Math.PI) < .01, 'halfway upside down');
        const before = R.airRollOf(r); R.move(r, 'left'); ok(R.airRollOf(r) === before, 'no snap on rapid reversal');
        tick(r, R.AIR.roll); ok(Math.abs(Math.sin(R.airRollOf(r) / 2)) < .01, 'reversal ends upright');
        const spec = V.runner3({run: r, mode: 'run'}, 1000); ok(spec.pitch === Math.PI / 2 && spec.flight === 1, 'horizontal headfirst pose');
      });
      test('Sky hits end flight with controlled descent; pills protect, and dodging avoids contact', () => {
        for (const mode of ['hit', 'pills', 'dodge']) {
          const r = empty(); pickup(r); tick(r, 1); r.sky.hazards = [{i: 'test-birds', kind: 'birds', lane: 1, z: r.z + 8, y: R.AIR.y}];
          if (mode === 'pills') r.pills = 3; if (mode === 'dodge') R.move(r, 'right');
          const e = tick(r, .7);
          ok(!r.over, 'sky contact never an instant ground tackle');
          if (mode === 'hit') { ok(e.some(e => e.type === 'airhit') && r.jetpack < R.JETPACK.descend, 'hit triggers landing'); tick(r, 1.3); ok(r.y < .02 && !R.flying(r), 'safe descent'); }
          else ok(!r.airHits && r.jetpack > 5, 'flight continues');
        }
      });
      test('Every player leaves the stadium once', () => {
        const c = empty().co; ok(R.zoneAt(c, 0).theme.id === 'stadium', 'opening field');
        for (let z = 500; z < 20000; z += 100) ok(R.zoneAt(c, z).theme.id !== 'stadium', 'no later football field');
        D.setMe('ben'); const shared = R.course(9090, 0, true, true); ok(R.zoneAt(shared, 900).theme.id !== 'stadium', 'no repeat field for other members'); D.setMe('evan');
      });
      test('Owner scenery lasts 500 physical yards, with 100-yard touchdowns and clear boundaries', () => {
        for (let n = 1; n <= 12; n++) {
          const co = R.fill(R.course(80000 + n, 0, true, true), 10000);
          ok(R.zoneLength(co) === 500, 'owner length');
          for (let i = 0; i < 20; i++) {
            const start = R.zoneAt(co, i * 500), end = R.zoneAt(co, i * 500 + 499.99);
            ok(start.i === i && start.z0 === i * 500 && end.theme === start.theme && end.i === i, 'full 500 yards per place');
            ok(R.zoneAt(co, (i + 1) * 500).theme !== start.theme, 'new theme at the boundary');
          }
          for (const s of co.sets) ok(s.ze <= R.zoneAt(co, s.zs).z0 + 490, 'vehicles leave room before each gate');
          ok(co.rows.every(row => row.th === R.zoneAt(co, row.z).theme.id), 'obstacle themes follow the longer scenery');
        }
        for (const boost of [false, true]) {
          const r = empty(); if (boost) r.pills = 1000;
          const events = []; while (r.z < 1001) events.push(...R.step(r, 1 / 60));
          eq(events.filter(e => e.type === 'zone').map(e => Math.floor(e.z)), [500, 1000], 'zone events only at 500-yard boundaries');
          ok(r.tds === 10 && Math.abs(r.yards - r.z * (boost ? 2 : 1)) < .001, 'touchdowns and boost scoring unchanged');
        }
        for (const id of ['ben', 'none']) { D.setMe(id); const co = R.course(80050, 0, true, true); ok(R.zoneLength(co) === 500 && R.zoneAt(co, 100).i === 0, 'shared 500-yard scenery'); }
        D.setMe('evan');
      });
      test('Every active power-up doubles points, overlaps stay 2x, and expiry restores 1x', () => {
        for (const kind of ['salts', 'pills', 'booze', 'jetpack']) {
          const r = empty(); r.co.items = [{i: 0, kind, lane: 1, z: .01}]; tick(r, .02); r.sky = null;
          const z = r.z, score = r.yards; tick(r, .5);
          ok(Math.abs((r.yards - score) - (r.z - z) * 2) < .001, kind + ' gives 2x');
          r.booze = r.pills = r.burst = r.jetpack = 1; ok(R.multiplierOf(r) === 2, 'overlap never 4x');
          r.booze = r.pills = r.burst = r.jetpack = 0; ok(R.multiplierOf(r) === 1, 'expired boosts do not double yards');
        }
      });
      test('Owner salts expire with the speed boost, including repeat pickups; expired salts cannot revive', () => {
        const collect = r => { r.co.items.push({i:r.co.items.length,kind:'salts',lane:1,z:r.z+.01}); return tick(r,.02); };
        const hit = r => { r.co.rows.push({i:r.co.rows.length,z:r.z+.01,lanes:[null,'hurdle',null]}); return tick(r,.02); };
        for (const dt of [1/30,1/60,1/120]) for (const count of [1,2]) {
          const r=empty(); for(let i=0;i<count;i++) collect(r);
          ok(r.salts===count && r.burst>9.8,'pickup grants active protection');
          tick(r,8,dt); ok(hit(r).some(e=>e.type==='stumbled'),'first impact brings the chaser');
          tick(r,r.burst+.02,dt);
          ok(r.burst===0 && r.salts===0 && R.multiplierOf(r)===1,'all unused salts expire with speed and double points');
          ok(R.chasing(r) && R.gapOf(r)<R.CHASE.seen,'chaser still visible after boost expires');
          ok(hit(r).some(e=>e.type==='tackled') && r.over,'expired salts cannot rescue the next collision');
        }
        const refreshed=empty(); collect(refreshed); tick(refreshed,8); collect(refreshed); tick(refreshed,3);
        ok(refreshed.salts===2 && refreshed.burst>6,'another pickup refreshes the active boost');
        tick(refreshed,refreshed.burst+.02); ok(refreshed.salts===0,'both unused lives expire with the refreshed boost');
        for (const wall of [false,true]) {
          const stale=empty(); stale.hitAt=stale.t; stale.salts=2; stale.burst=0;
          if(wall) train(stale,1,.01);
          const ev=wall?tick(stale,.02):hit(stale);
          ok(stale.over && !ev.some(e=>e.type==='revived'),'an expired balance cannot revive against a '+(wall?'train':'row'));
        }
        for (const profile of ['ben','Ryan Stewart','Evan Appenzeller',null]) {
          D.setMe(profile==='ben'?'ben':'none'); D.setGuest(profile==='ben'?null:profile);
          const r=R.startRun(70002,0,true,false,true);
          r.co={...r.co,rows:[],sets:[],items:[],z:1e9,done:1e9}; r.t=10;
          collect(r); tick(r,11);
          ok(r.co.enhanced && r.salts===1 && r.burst===0,'other profiles keep their existing stored salts and updated course');
          r.hitAt=r.t;
          ok(hit(r).some(e=>e.type==='revived') && !r.over,'stored salts still revive other profiles after boost expiry');
        }
        D.setGuest(null); D.setMe('evan');
        ok(R.powerOf('salts',true,true).does.includes('expire'),'owner pickup announcement explains expiry');
        ok(!R.powerOf('salts',true).does.includes('expire'),'shared pickup copy unchanged');
      });
      test('A stumble stays lethal until the visible chaser finishes retreating', () => {
        const hit = r => { r.co.rows.push({i: r.co.rows.length, z: r.z + .01, lanes: [null, 'hurdle', null]}); return tick(r, .02); };
        const r = empty(); ok(hit(r).some(e => e.type === 'stumbled'), 'first hit is a stumble');
        tick(r, 3.8); ok(R.chasing(r) && R.gapOf(r) < R.CHASE.seen, 'chaser stays for four seconds');
        const near = empty(); hit(near); tick(near, 3.7); ok(hit(near).some(e => e.type === 'tackled'), 'second hit inside window tackles');
        tick(r, .3); ok(R.chasing(r) && r.stumblePending && R.gapOf(r) < R.CHASE.seen, 'chase remains lethal while visibly retreating');
        tick(r, .6); ok(!R.chasing(r) && !r.stumblePending && R.gapOf(r) >= R.CHASE.seen, 'only leaving the screen clears the chase');
        ok(hit(r).some(e => e.type === 'stumbled') && !r.over, 'later hit starts a new pursuit');
        const clean = empty(); tick(clean, 1);
        const st = {run: clean, mode: 'run'}, main = V.runner3(st, 10000), chase = V.chaser3(st, 10000, clean.z - 3);
        ok(main.move === chase.move && main.phase === chase.phase && main.lift === chase.lift && main.pitch === chase.pitch, 'same running clip, stride, bounce and lean');
      });
      test('Every profile is tackled by a distinct unprotected hit while the chaser is visible', () => {
        const rowHit = (r, ob = 'hurdle') => { r.co.rows.push({i:r.co.rows.length,z:r.z+.01,lanes:[null,ob,null],th:'stadium'}); return tick(r,.02); };
        for (const profile of ['evan','ben','none']) for (const dt of [1/30,1/60,1/120]) for (const elapsed of [.2,1,3.9,4.02,4.1,4.2]) for (const kind of ['hurdle','bar','hole','low vehicle','vehicle side','edge']) {
          const r=empty(profile); rowHit(r); tick(r,Math.max(0,elapsed-(r.t-r.hitAt)),dt);
          const st={run:r,camZ:r.z-7,lag:0,dt,mode:'run'};
          ok(V.chaserAt(st)!==null, 'chaser visible before '+kind+' at '+elapsed);
          let events;
          if (['hurdle','bar','hole'].includes(kind)) events=rowHit(r,kind);
          else if (kind==='edge') { r.lane=0; r.x=R.xOf(r,0); R.move(r,'left'); events=tick(r,.02,dt); }
          else {
            const side=kind==='vehicle side', p={lane:side?0:1,kind:'bench',part:0,z0:side?r.z-1:r.z+.01,z1:r.z+8,h:side?R.HIGH_H:R.LOW_H,b:0,ramp:0,hi:side};
            r.co.sets=[{i:0,zs:p.z0,ze:p.z1,plats:[p]}];
            if(side) R.move(r,'left'); events=tick(r,.02,dt);
          }
          ok(r.over && events.some(e=>e.type==='tackled') && r.hits===1, kind+' must tackle, not give another stumble, at '+elapsed+' / '+dt);
        }
        const r=empty(); rowHit(r); ok(r.grace>0,'inside duplicate-contact grace');
        ok(rowHit(r,'bar').some(e=>e.type==='tackled') && r.over,'a distinct obstacle is never ignored by grace');
      });
      test('Visible-chaser hits preserve painkillers and active salts; duplicate contacts still count once', () => {
        const hit = r => { r.co.rows.push({i:r.co.rows.length,z:r.z+.01,lanes:[null,'hurdle',null]}); return tick(r,.02); };
        for (const elapsed of [.8,4.1]) for (const boost of ['pills','salts','booze','burst','shield','combined']) {
          const r=empty(); hit(r); tick(r,elapsed);
          if(boost==='combined') Object.assign(r,{pills:6,salts:2,booze:6,burst:10,shield:1}); else r[boost]=boost==='salts'?2:6;
          if(boost==='salts') r.burst=10;
          const salts=r.salts, events=hit(r);
          if (boost==='pills' || boost==='combined') ok(!r.over && r.salts===salts && events.some(e=>e.type==='trucked'),'painkillers keep their protection without spending salts');
          else if (boost==='salts') {
            ok(!r.over && r.salts===salts-1 && events.some(e=>e.type==='revived'),'one active life saves the collision');
            ok(hit(r).some(e=>e.type==='revived') && r.salts===0 && !r.over,'second active life saves a second collision');
            ok(hit(r).some(e=>e.type==='tackled') && r.over,'without salts the very next collision tackles');
          } else ok(r.over && events.some(e=>e.type==='tackled'),boost+' is not obstacle protection');
        }
        const r=empty(); r.lane=0; r.x=R.xOf(r,0); R.move(r,'left'); tick(r,.02);
        tick(r,.2); ok(R.gapOf(r)<R.CHASE.seen && r.grace>0,'visible chaser during edge-contact grace');
        R.move(r,'left'); const repeated=tick(r,.02);
        ok(!r.over && r.hits===1 && repeated.some(e=>e.type==='shoved'),'holding against the same edge is still one contact');
      });
      test('Jetpack descent lands on moving roofs, stays supported, and permits a roof jump', () => {
        for (const dt of [1 / 30, 1 / 120]) {
          const r = empty(); r.y = R.JETPACK.height; r.jetpack = .8; r.jetAge = 7.2;
          const p = train(r, 1, -12); p.z1 = 80;
          const events = tick(r, .8, dt);
          ok(events.some(e => e.type === 'jetlanded') && !R.flying(r) && r.y === p.h, 'feet contact moving roof');
          ok(R.surfaceAt(r, 1, r.z, r.y) === p.h && !p.cleared, 'roof stays solid and does not consume vehicle collision');
          tick(r, .2, dt); ok(r.y === p.h && !r.over, 'supported after fuel ends');
          ok(R.move(r, 'up') && r.vy > 0, 'can jump from moving roof');
          tick(r, .1, dt); ok(r.y > p.h, 'roof jump rises');
          R.move(r, 'left'); tick(r, 1, dt); ok(r.lane === 0 && r.y < p.h, 'can leave roof naturally');
        }
      });
      return results;
    });
    console.log(report.gameplay.map(x => 'PASS ' + x).join('\n'));
    await page.evaluate(async () => {
      const {D, R, V, D3} = window.qa; D.setMe('evan');
      if (!await D3.load()) throw new Error('3D player failed to load');
      const el = document.querySelector('main'); el.innerHTML = V.render({});
      el.querySelector('[data-rm-card]').hidden = true;
      const cv = el.querySelector('[data-rm-cv]'), fx = el.querySelector('[data-rm-fx]');
      cv.width = fx.width = 430; cv.height = fx.height = 820; cv.style.height = '820px';
      const run = R.startRun(98999, 0, true, false, true);
      run.co = {...run.co, order: [2], rows: [], sets: [], items: [], traffic: [], z: 1e9, done: 1e9};
      run.z = run.yards = 200; run.t = 12; run.steps = 1.25;
      run.trains = [{i: 'visual', lane: 2, kind: 'express', part: 0, z0: 211, z1: 231, h: R.TRAFFIC.height, b: 0, ramp: 0, hi: true}];
      const st = {el, cv, fx, c2: cv.getContext('2d'), c3: fx.getContext('2d'), layers: el.querySelector('[data-rm-layers]'), glHost: el.querySelector('[data-rm-gl]'), ctx: {visible: true},
        run, co: run.co, n: run.n, day: {best: 0}, mode: 'run', W: 430, H: 820, dpr: 1, f: 451.5, y0: 230, camH0: 4.4, back: 7,
        dt: 1 / 60, got: new Set(), knocked: new Map(), coinGot: new Set(), sparks: [], trafficUntil: 15, trafficLane: 'SWIPE TO DODGE'};
      window.qa.st = st;
      window.qa.render = () => { V.draw(st, 12000); V.patchHud(st); };
      window.qa.render();
      await D3.prepare(st);
    });
    await page.waitForTimeout(1200);
    report.scenery = await page.evaluate(async () => {
      const {R,V,st} = window.qa, W = await import('/js/views/return-world.js'), W3 = await import('/js/views/return-3dworld.js');
      const original = {co:st.run.co,z:st.run.z,yards:st.run.yards,trains:st.run.trains};
      const co = {...R.course(80061,0,true,true),rows:[],sets:[],items:[],traffic:[],z:1e9,done:1e9};
      st.run.co=co; st.run.trains=[];
      const checks=[];
      for (const z of [100,250,490,500,750,990,1000]) {
        st.run.z=st.run.yards=z;
        for(let i=0;i<12;i++) V.draw(st,12000);
        const gates=[...W3.LIVE].filter(([key])=>key.startsWith('g:')).map(([,v])=>-v.obj.position.z);
        if(gates.some(g=>g%500!==0) || (z===490 && !gates.includes(500)) || (z===990 && !gates.includes(1000))) throw new Error('Wrong scenery gate at '+z);
        const chunks=[...W3.LIVE].filter(([key])=>key.startsWith('c:')).map(([,v])=>v.obj);
        if(chunks.some(c=>c.userData.theme!==R.zoneAt(co,c.userData.z0+.01).theme.id)) throw new Error('Wrong ground theme at '+z);
        const a=W.blendAt(st,z), zone=R.zoneAt(co,z);
        if(a.now.id!==zone.theme.id || a.next.id!==R.zoneAt(co,zone.z0+500).theme.id || (z===250 && a.k!==0) || (z===490 && a.k===0)) throw new Error('Wrong sky transition');
        // Exercise the actual canvas fallback at both ends of a long scenery stretch.
        st.flat=true; V.draw(st,12000); st.flat=false;
        checks.push({z,theme:zone.theme.id,gates,tiles:chunks.length});
      }
      Object.assign(st.run,original); for(let i=0;i<12;i++) V.draw(st,12000);
      return checks;
    });
    console.log('PASS 500-yard 3D gates, ground tiles, sky transitions and canvas fallback');
    await page.evaluate(() => {
      const {R,V,st}=window.qa, saved=st.run;
      const r=R.startRun(70111,0,true,false,true);
      r.co={...r.co,rows:[],sets:[],items:[],traffic:[],z:1e9,done:1e9}; r.t=10; r.salts=2; r.burst=.02;
      st.run=r; V.patchHud(st);
      if(!st.el.querySelector('[data-rm-pows] .is-salts')) throw new Error('Active salts missing from HUD');
      R.step(r,.05); V.patchHud(st);
      if(st.el.querySelector('[data-rm-pows] .is-salts') || st.el.querySelector('[data-rm-ychip]').classList.contains('is-x2')) throw new Error('Expired salts remain on HUD');
      st.run=saved; V.patchHud(st);
    });
    console.log('PASS Expired salts disappear from the HUD with the speed boost and double points');
    await page.evaluate(() => { for (let i = 0; i < 12; i++) window.qa.render(); });
    await page.screenshot({path: path.join(output, 'incoming-train.png')});
    report.render = await page.evaluate(async () => {
      const {st, R, V, D3} = window.qa;
      const start = D3.GL.players.us.root.position.y;
      st.run.jetpack = 5; st.run.jetAge = 3; st.run.y = R.JETPACK.height;
      st.run.sky = {hazards: [{i: 'visual-birds', kind: 'birds', lane: 0, z: 215, y: R.AIR.y}, {i: 'visual-drone', kind: 'drone', lane: 2, z: 226, y: R.AIR.y}], coins: Array.from({length: 14}, (_, i) => ({i: -i - 1, lane: 1, z: 205 + i * 2.8, y: R.AIR.y, air: true}))};
      for (let i = 0; i < 120; i++) window.qa.render();
      const p = D3.GL.players.us;
      if (!p.jetpack?.visible || !st.el.querySelector('.is-jetpack') || !Number.isFinite(p.root.position.y)) throw new Error('Flight visual missing');
      const T = await import('/js/vendor/three/three.module.min.js');
      const at = key => p.B[key].getWorldPosition(new T.Vector3()).toArray();
      const bones = Object.fromEntries(['Head', 'Hips', 'LeftFoot', 'RightFoot', 'LeftHand', 'RightHand', 'Spine2'].map(k => [k, at(k)]));
      if (!(bones.Head[2] < bones.Hips[2] - .3 && bones.LeftFoot[2] > bones.Hips[2] && Math.abs(bones.Head[1] - bones.Hips[1]) < .22)) throw new Error('Runner must be horizontal, head ahead of hips and feet: ' + JSON.stringify(bones));
      const pack = p.jetpack.getWorldPosition(new T.Vector3()).toArray();
      if (!(pack[1] > bones.Spine2[1])) throw new Error('Pack must be above the belly-down torso: ' + JSON.stringify({pack, bones}));
      return {bounce: start, bones, packVisible: p.jetpack.visible, flightY: p.root.position.y, cameraY: st.camH};
    });
    await page.screenshot({path: path.join(output, 'jetpack-flight.png')});
    for (const [name, angle] of [['quarter-roll', Math.PI / 2], ['half-roll', Math.PI]]) {
      await page.evaluate(angle => { const {st, D3} = window.qa; st.run.airRollFrom = st.run.airRollTo = angle; window.qa.render();
        const p = D3.GL.players.us; if (Math.abs(p.root.rotation.z + angle) > .001) throw new Error('Barrel roll rotation missing');
      }, angle);
      await page.screenshot({path: path.join(output, name + '.png')});
    }
    await page.evaluate(() => { const {st} = window.qa; st.run.airRollFrom = st.run.airRollTo = 0; });
    report.skyMemory = await page.evaluate(() => {
      const {st, D3} = window.qa, sky = st.run.sky;
      const counts = [];
      for (let i = 0; i < 8; i++) {
        st.run.jetpack = 5; st.run.sky = {...sky, hazards: sky.hazards.map(h => ({...h, i: h.i + '-' + i}))}; window.qa.render();
        st.run.jetpack = 0; st.run.sky = null; window.qa.render(); counts.push(D3.GL.renderer.info.memory.geometries);
      }
      if (counts[7] > counts[1] + 2) throw new Error('Expired sky courses leak GPU geometry: ' + counts);
      st.run.jetpack = 5; st.run.sky = sky; return counts;
    });
    // Exercise the actual full 2D fallback with the same run and controls.
    await page.evaluate(async () => {
      const {st, V} = window.qa;
      await (await import('/js/views/drill-sprites.js')).load();
      st.flat = true; st.run.co.items = [{i: 99, lane: 0, z: st.run.z + 12, kind: 'jetpack'}];
      V.draw(st, 12000);
      const c = st.c2;
      if (!c.getImageData(0, 0, 430, 820).data.some((v, i) => i % 4 === 3 && v)) throw new Error('2D fallback empty');
    });
    await page.screenshot({path: path.join(output, 'fallback-gear.png')});
    await page.evaluate(() => {
      const {st, V, R} = window.qa; st.flat = false; st.run.jetpack = 0; st.run.y = R.TRAFFIC.height;
      st.run.trains = [{i: 'roof-landing', lane: 1, kind: 'express', part: 0, z0: st.run.z - 4, z1: st.run.z + 16, h: R.TRAFFIC.height, b: 0, ramp: 0, hi: true}];
      for (let i = 0; i < 60; i++) V.draw(st, 13000 + i * 17);
      if (V.runner3(st, 14000).move !== 'run') throw new Error('Moving roof must use the grounded running pose');
    });
    await page.screenshot({path: path.join(output, 'moving-roof-landing.png')});
    await page.evaluate(() => {
      const {R, V} = window.qa; R.setTest(true);
      const el = document.querySelector('main'), ctx = {visible: true, timer: () => () => {}};
      window.qa.ctx = ctx; V.mount(el, ctx);
    });
    await page.waitForFunction(() => document.querySelector('[data-rm-cv]').__rm.warmed);
    assert(await page.evaluate(() => { const st = document.querySelector('[data-rm-cv]').__rm; return st.mode === 'ready' && !st.run && !document.querySelector('[data-rm-card]').hidden; }), 'owner waits on start screen after loading');
    await page.waitForTimeout(200);
    await page.screenshot({path: path.join(output, 'start-screen.png')});
    await page.setViewportSize({width: 375, height: 667});
    const small = await page.addStyleTag({content: '.rm-pane{width:375px}.rm-stage{height:610px!important}'});
    const start = await page.locator('[data-rm-go]').boundingBox();
    assert(start && start.y >= 0 && start.y + start.height <= 667, 'start button fits a small phone');
    await page.screenshot({path: path.join(output, 'start-screen-small.png')});
    await small.evaluate(el => el.remove()); await page.setViewportSize({width: 430, height: 820});
    await page.locator('[data-rm-go]').click();
    await page.waitForFunction(() => document.querySelector('[data-rm-cv]').__rm.mode === 'run');
    await page.evaluate(() => {
      const {R} = window.qa, st = document.querySelector('[data-rm-cv]').__rm, r = st.run;
      r.co = {...r.co, rows: [], sets: [], items: [{i: 0, z: r.z + .1, lane: 1, kind: 'jetpack'}], traffic: [], z: 1e9, done: 1e9};
      r.next = r.nextItem = r.nextCone = 0;
      window.qa.mounted = st;
    });
    await page.waitForFunction(() => window.qa.R.flying(window.qa.mounted.run));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.qa.mounted.run.lane === 2 && window.qa.mounted.run.jt === 1);
    await page.locator('[data-rm-stage]').dispatchEvent('pointerdown', {pointerId: 1, isPrimary: true, button: 0, clientX: 270, clientY: 600});
    await page.locator('[data-rm-stage]').dispatchEvent('pointermove', {pointerId: 1, isPrimary: true, clientX: 180, clientY: 600});
    await page.locator('[data-rm-stage]').dispatchEvent('pointerup', {pointerId: 1, isPrimary: true, clientX: 180, clientY: 600});
    await page.waitForFunction(() => window.qa.mounted.run.lane === 1);
    await page.evaluate(() => { const r=window.qa.mounted.run; r.salts=1; r.burst=2; window.qa.ctx.visible = false; });
    await page.waitForFunction(() => window.qa.mounted.mode === 'paused');
    const paused = await page.evaluate(() => { const r=window.qa.mounted.run; return [r.t,r.jetpack,r.burst,r.salts]; });
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => { const r=window.qa.mounted.run; return [r.t,r.jetpack,r.burst,r.salts]; }), paused, 'pause freezes fuel, salts and movement');
    await page.evaluate(() => { window.qa.ctx.visible = true; });
    await page.locator('[data-rm-resume]').evaluate(b => b.click());
    await page.waitForFunction(() => window.qa.mounted.mode === 'run');
    await page.evaluate(() => { window.qa.D.setMe('ben'); });
    assert(await page.evaluate(() => !window.qa.mounted.run.over && document.querySelector('.is-jetpack')), 'live profile change retains shared flight and HUD');
    await page.evaluate(() => { window.qa.V.unmount(document.querySelector('main'), window.qa.ctx); });
    report.input = 'Keyboard, pointer swipe, pause/resume and live profile change passed';
    console.log('PASS ' + report.input);
    assert.deepEqual(external, [], 'no network/score posting'); assert.deepEqual(errors, [], 'no runtime errors');
    report.passed = true; console.log('PASS mobile 3D train, flight, HUD and 2D fallback render');
  } finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({...report, errors, external}, null, 2)); await browser.close(); }
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
