// Local team marks for Rivals graphic backgrounds. Uses the same ESPN asset source as logoUrl().
// Run: node tools/dynasty/download-team-logos.mjs
// Requires Node 18+ and sharp (the shared Codex Node dependencies can be exposed with NODE_PATH).
// Team names and trademarks belong to their respective owners. Oversized sources are resized to 500px.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'img/rivals/team-graphics-v2');
const {teams} = JSON.parse(await fs.readFile(path.join(root, 'data/dynasty.json'), 'utf8'));
await fs.mkdir(out, {recursive: true});
const entries = Object.entries(teams).sort(([a], [b]) => a.localeCompare(b));
const results = [];
for (let offset = 0; offset < entries.length; offset += 4) {
  const batch = await Promise.all(entries.slice(offset, offset + 4).map(async ([team, details]) => {
    const alias = String(details[5] || team).toLowerCase();
    const source = `https://a.espncdn.com/i/teamlogos/nfl/500/${alias}.png`;
    const response = await fetch(source, {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`${team}: HTTP ${response.status}`);
    let bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${team}: not a PNG`);
    const sourceWidth = bytes.readUInt32BE(16), sourceHeight = bytes.readUInt32BE(20);
    if (sourceWidth < 500 || sourceHeight < 500) throw new Error(`${team}: unexpected dimensions ${sourceWidth}x${sourceHeight}`);
    const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
    if (sourceWidth !== 500 || sourceHeight !== 500) bytes = await sharp(bytes).resize(500, 500).png().toBuffer();
    const file = `${team.toLowerCase()}.png`;
    await fs.writeFile(path.join(out, file), bytes);
    return {team, name: details[0], file, source, width: 500, height: 500, sourceWidth, sourceHeight, sourceSha256, bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')};
  }));
  results.push(...batch);
  console.log(`Downloaded ${results.length}/${entries.length} team marks`);
}
if (results.length !== 32 || new Set(results.map(result => result.sha256)).size !== 32) {
  throw new Error('Expected 32 distinct team marks');
}
await fs.writeFile(path.join(out, 'sources.json'), JSON.stringify({
  about: 'NFL team marks from ESPN, the established source used by the app. Team names and trademarks belong to their respective owners.',
  fetchedAt: new Date().toISOString(), assets: results
}, null, 2) + '\n');
console.log(`PASS: 32 distinct PNG team marks at least 500x500, ${results.reduce((n, item) => n + item.bytes, 0)} bytes`);
