// Live league scores on the Scores tab's League screen (core/fantasy-live.js, views/live-league.js, views/live.js) in a
// real browser.
// Local only: the app is served from this folder with Firebase disabled, and ESPN's scoreboard and box scores are
// stand-ins built from the league file's own lineups (every starter gets a line), so nothing reaches the network.
// For Evan, another member and a visitor: Scores opens on NFL with the NFL · League switch; League shows this week's
// games with each side's live score and players left; Evan's game opens the sheet with the live score, both lineups
// (nine slots) whose points add up to the score, and the next feed update moves it; League is remembered after a
// reload, NFL comes back with the octobox; Matchup's "Live scores" opens League; then the kit checks "Live league
// scores" and "Live Games".
// Usage: node tools/matchup/check-live-browser.cjs [--shots=<dir>]   (Playwright's Chromium; screenshots when --shots)
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, {recursive: true});

function server() {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      if (file.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replace(/(<script id="firebase-config"[^>]*>)[\s\S]*?(<\/script>)/, '$1{}$2'));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(bytes);
    });
  });
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve(s)));
}

// ---------------------------------------------------------------------------------------------- ESPN stand-ins
const league = JSON.parse(fs.readFileSync(path.join(root, 'data/league.json'), 'utf8'));
const season = league.seasons.find(s => s.rosters && s.rosters.teams);
const YEAR = season.year;
const WEEK = (season.schedule || []).reduce((w, g) => Math.min(w, g.week), 99);
const ESPN = {WAS: 'WSH'};
const TEAMS = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WSH'];
// Two teams on a bye; the rest pair up: the first game final (Thursday), four still to kick off, the others on.
const BYE = ['NYJ', 'SEA'];
const playing = TEAMS.filter(t => !BYE.includes(t));
const games = [];
for (let i = 0; i < playing.length; i += 2) {
  const n = games.length, state = n === 0 ? 'post' : n >= 11 ? 'pre' : 'in';
  games.push({id: String(401800000 + n), away: playing[i], home: playing[i + 1], state});
}
let tick = 0; // each feed update adds a little to everyone's line
let seed = 7;
const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const lines = new Map(); // name|team -> base line
function lineFor(name, pos) {
  if (!lines.has(name)) {
    if (pos === 'QB') lines.set(name, {pass: [15 + rnd(10), 25 + rnd(10), 160 + rnd(150), rnd(3), rnd(2)], rush: [2 + rnd(5), rnd(30), 0]});
    else if (pos === 'RB') lines.set(name, {rush: [8 + rnd(12), 30 + rnd(70), rnd(2)], rec: [rnd(5), rnd(40), 0, 1 + rnd(5)]});
    else lines.set(name, {rec: [1 + rnd(7), 10 + rnd(90), rnd(2), 2 + rnd(8)]});
  }
  return lines.get(name);
}
function scoreboard() {
  const now = Date.now();
  return {season: {year: YEAR, type: 2}, week: {number: WEEK}, leagues: [{season: {year: YEAR, type: {type: 2}}, calendar: []}],
    events: games.map((g, i) => ({id: g.id, date: new Date(g.state === 'pre' ? now + (2 + i) * 36e5 : now - 2 * 36e5).toISOString(), shortName: `${g.away} @ ${g.home}`,
      competitions: [{status: {period: g.state === 'in' ? 3 : 4, displayClock: '4:12', type: {state: g.state, completed: g.state === 'post', name: g.state === 'post' ? 'STATUS_FINAL' : g.state === 'in' ? 'STATUS_IN_PROGRESS' : 'STATUS_SCHEDULED', shortDetail: g.state === 'post' ? 'Final' : g.state === 'in' ? '4:12 - 3rd' : 'Sun 1:00 PM'}},
        competitors: [{homeAway: 'home', score: String(g.state === 'pre' ? 0 : 17 + tick), team: {id: g.home, abbreviation: g.home, displayName: g.home}},
          {homeAway: 'away', score: String(g.state === 'pre' ? 0 : 10), team: {id: g.away, abbreviation: g.away, displayName: g.away}}]}]}))};
}
function summary(id) {
  const g = games.find(x => x.id === id);
  const cat = (name, keys, rows) => ({name, keys, labels: [], athletes: rows.map(([nm, st]) => ({athlete: {id: '', displayName: nm}, stats: st.map(String)}))});
  const side = abbr => {
    const ps = Object.values(season.rosters.teams).flat().filter(p => (ESPN[p[2]] || p[2]) === abbr && !['DEF'].includes(p[1]));
    const qb = [], ru = [], re = [], ki = [];
    ps.forEach(([name, pos]) => {
      if (pos === 'K') { ki.push([name, [`${2 + (tick ? 1 : 0)}/3`, '66.7', '48', '2/2', '8']]); return; }
      const L = lineFor(name, pos);
      if (L.pass) qb.push([name, [`${L.pass[0] + tick}/${L.pass[1] + tick}`, L.pass[2] + 10 * tick, L.pass[3], L.pass[4]]]);
      if (L.rush) ru.push([name, [L.rush[0], L.rush[1] + 5 * tick, L.rush[2]]]);
      if (L.rec) re.push([name, [L.rec[0] + tick, L.rec[1] + 10 * tick, L.rec[2], L.rec[3] + tick]]);
    });
    return {team: {id: abbr, abbreviation: abbr}, statistics: [
      cat('passing', ['completions/passingAttempts', 'passingYards', 'passingTouchdowns', 'interceptions'], qb),
      cat('rushing', ['rushingAttempts', 'rushingYards', 'rushingTouchdowns'], ru),
      cat('receiving', ['receptions', 'receivingYards', 'receivingTouchdowns', 'receivingTargets'], re),
      cat('kicking', ['fieldGoalsMade/fieldGoalAttempts', 'fieldGoalPct', 'longFieldGoalMade', 'extraPointsMade/extraPointAttempts', 'totalKickingPoints'], ki),
      cat('defensive', ['totalTackles', 'soloTackles', 'sacks'], [['Some Rusher', ['3', '2', String(1 + tick)]]])]};
  };
  const kick = abbr => Object.values(season.rosters.teams).flat().find(p => p[1] === 'K' && (ESPN[p[2]] || p[2]) === abbr);
  const plays = [g.home, g.away].map(t => kick(t)).filter(Boolean).map(k => ({type: {text: 'Field Goal Good'}, text: `${k[0]} 48 Yd Field Goal`, team: {abbreviation: ESPN[k[2]] || k[2]}}));
  return {boxscore: {players: [side(g.away), side(g.home)]}, scoringPlays: plays};
}

const PROFILES = [{tag: 'evan', me: 'evan'}, {tag: 'mason', me: 'mason'}, {tag: 'visitor', me: 'none'}];
const snap = (page, name) => (shots ? page.screenshot({path: path.join(shots, name + '.png')}) : Promise.resolve());

async function run(url) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const p of PROFILES) {
      tick = 0;
      const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'dark'});
      await context.route('https://**/*', route => {
        const u = new URL(route.request().url());
        if (u.hostname === 'site.api.espn.com' && /\/nfl\/scoreboard$/.test(u.pathname)) return route.fulfill({json: scoreboard(), headers: {'access-control-allow-origin': '*'}});
        if (u.hostname === 'site.api.espn.com' && /\/nfl\/summary$/.test(u.pathname)) return route.fulfill({json: summary(u.searchParams.get('event')), headers: {'access-control-allow-origin': '*'}});
        return route.abort();
      });
      await context.addInitScript(p => {
        localStorage.setItem('gg-me', p.me);
        localStorage.setItem('gg-welcome', '1');
        ['evan', 'mason', 'visitor'].forEach(k => localStorage.setItem('gg-release-3.0:' + k, '1'));
      }, p);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e));
      page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|firebase|navigator\.vibrate/i.test(m.text())) errors.push(m.text()); });
      await page.goto(url + '/#/live');
      await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      // Scores opens on NFL, the switch's two buttons under the title.
      await page.waitForSelector('.v-live .lg-sw [data-lg-mode="lg"]', {timeout: 20000});
      assert.equal(await page.locator('.v-live .lg-sw .pk-lg-t').count(), 2, p.tag + ': NFL and League');
      assert.equal(await page.locator('.v-live [data-lg-mode="nfl"]').getAttribute('aria-selected'), 'true', p.tag + ': NFL first');
      await page.waitForSelector('.v-live .lg-tile', {timeout: 20000});
      await page.waitForTimeout(2500); // (the splash goes)
      await snap(page, p.tag + '-nfl');
      await page.locator('.v-live [data-lg-mode="lg"]').click();
      await page.waitForSelector('.v-live .ll-gm.is-live', {timeout: 20000});
      await page.waitForTimeout(600); // (the cross-fade's snapshot goes)
      assert.equal(await page.locator('.v-live [data-lg-nfl]').isHidden(), true, p.tag + ': NFL hides');
      assert.match(await page.locator('.v-live .lt-eyebrow').textContent(), /^League · Week \d+ · Live$/);
      const items = await page.locator('.v-live .ll-gm').count();
      const liveN = await page.locator('.v-live .ll-gm.is-live').count();
      assert.equal(liveN, items, p.tag + ': every game this week shows a live score');
      assert.ok(items >= 4, p.tag + ': the week\u2019s games');
      assert.match(await page.locator('.v-live .ll-games .lg-at').textContent(), /Updated/, p.tag + ': the week reads live');
      const label = await page.locator('.v-live .ll-gm.is-live').first().getAttribute('aria-label');
      assert.match(label, /\d+\.\d\d, .+ \d+\.\d\d, live\. Show the lineups/, p.tag + ': a live game reads its score');
      await page.waitForTimeout(400);
      await snap(page, p.tag + '-games');
      // Evan's game (Jayton's for the visitor too): the sheet.
      const key = await page.evaluate(() => [...document.querySelectorAll('.v-live .ll-gm')].map(b => b.dataset.llG).find(k => k.split('|').includes('evan')));
      await page.locator(`.v-live .ll-gm[data-ll-g="${key}"]`).click();
      await page.waitForSelector('.sh-ll .ll-lu-row', {timeout: 10000});
      await page.waitForTimeout(600);
      const sheet = await page.evaluate(() => {
        const b = document.querySelector('.sh-ll');
        const num = el => parseFloat(el.textContent.replace(/[^\d.−-]/g, '').replace('−', '-'));
        const rows = [...b.querySelectorAll('.ll-lu-row')];
        const sum = k => Math.round(rows.reduce((a, r) => a + (num(r.querySelector('.ll-lu-pts.' + k)) || 0), 0) * 100) / 100;
        return {rows: rows.length, slots: rows.map(r => r.querySelector('.ll-lu-slot').textContent), hero: [...b.querySelectorAll('.ll-live')].map(num),
          sumA: sum('a'), sumB: sum('b'), foot: b.querySelector('.ll-bug .bug-foot').textContent, head: b.querySelector('.ll-lu-w .mu-h').textContent};
      });
      assert.equal(sheet.rows, 9, p.tag + ': nine lineup slots');
      assert.deepEqual(sheet.slots.slice(0, 1).concat(sheet.slots.slice(-2)), ['QB', 'K', 'DEF'], p.tag + ': Yahoo\u2019s slot order');
      assert.equal(sheet.hero.length, 2, p.tag + ': the live score in the hero');
      assert.ok(Math.abs(sheet.hero[0] - sheet.sumA) < .011 && Math.abs(sheet.hero[1] - sheet.sumB) < .011, `${p.tag}: the lineups add up to the score (${sheet.hero} vs ${sheet.sumA}, ${sheet.sumB})`);
      assert.match(sheet.foot, /LIVE · \d+ PLAYERS? LEFT/, p.tag + ': the foot says live');
      assert.equal(sheet.head, 'Lineups · live');
      await snap(page, p.tag + '-sheet');
      await page.locator('.sh-ll .ll-note').scrollIntoViewIfNeeded();
      await snap(page, p.tag + '-sheet-lineups');
      // The next update (every 30 s while a game is on): the score moves on the open sheet. (Once, on Evan's phone.)
      if (p.tag === 'evan') {
      tick = 1;
      await page.waitForFunction(was => {
        const n = [...document.querySelectorAll('.sh-ll .ll-live')].map(el => parseFloat(el.textContent.replace(/[^\d.]/g, '')));
        return n.length === 2 && (n[0] !== was[0] || n[1] !== was[1]);
      }, sheet.hero, {timeout: 45000});
      await snap(page, p.tag + '-sheet-moved');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      // League is remembered: a reload opens on it; then NFL comes back with its games.
      await page.reload();
      await page.waitForFunction(() => window.__ggBooted, null, {timeout: 30000});
      await page.waitForSelector('.v-live .ll-gm.is-live', {timeout: 20000});
      assert.equal(await page.locator('.v-live [data-lg-mode="lg"]').getAttribute('aria-selected'), 'true', p.tag + ': League remembered');
      await page.locator('.v-live [data-lg-mode="nfl"]').click();
      await page.waitForSelector('.v-live [data-lg-nfl]:not([hidden]) .lg-tile', {timeout: 20000});
      await page.waitForTimeout(600); // (the cross-fade's snapshot goes)
      assert.equal(await page.locator('.v-live [data-ll]').isHidden(), true, p.tag + ': League hides');
      // Matchup no longer lists this week's games (Oct 30 2026, the owner: "Remove this from the matchups tab").
      await page.goto(url + '/#/matchup');
      await page.waitForSelector('.v-rivals .rv-h2h-t', {state: 'attached', timeout: 20000});
      assert.equal(await page.locator('.v-rivals .rv-games, .v-rivals [data-rv-live], .v-rivals .rv-gm').count(), 0, p.tag + ': Matchup has no week\u2019s games');
      console.log(`${p.tag}: ${liveN} live games; Evan’s game ${sheet.hero.join(' – ')}${p.tag === 'evan' ? ', then moved with the feed' : ''}`);
      if (p.tag === 'evan') {
        const out = await page.evaluate(async () => {
          const {runChecks} = await import('/js/core/checks.js');
          const all = await runChecks();
          return all.filter(c => /^Live (league scores|Games)/.test(c.name)).map(c => ({name: c.name.slice(0, 40), pass: c.pass, detail: c.detail}));
        });
        out.forEach(c => console.log(`${c.pass ? 'pass' : 'FAIL'} ${c.name}… ${c.detail}`));
        assert.equal(out.length, 2, 'both kit checks ran');
        assert.ok(out.every(c => c.pass), 'kit checks pass');
      }
      assert.deepEqual(errors, [], p.tag + ': unexpected browser exceptions');
      await context.close();
    }
  } finally { await browser.close(); }
  console.log('PASS: live league scores on the Scores tab');
}

server().then(async s => {
  try { await run(`http://127.0.0.1:${s.address().port}`); }
  catch (e) { console.error(e); process.exitCode = 1; }
  finally { s.close(); }
});
