// Gridiron Dynasty's stylesheets stay scoped to the Dynasty (the Pick'em page broke, Oct 29 2026: Dynasty's .pk-list,
// .pk-foot, .pk-tile and .pk-banner, unscoped, landed on the Pick'em's game cards, which share the pk- prefix).
// Every style rule in css/views/dynasty.css, dynasty-packs.css and dynasty-open.css must start from a Dynasty root:
// :where(.v-dynasty, …), .v-dynasty, .v-dynasty-battle, .sheet.pk-sheet / .pk-sheet, div.pk-open, .pk-behind (the
// elements behind an opening), html / :root / body or #stage. Keyframes and at-rule heads are not rules.
// Usage: node tools/dynasty/check-scope.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const FILES = ['css/views/dynasty.css', 'css/views/dynasty-packs.css', 'css/views/dynasty-open.css'];
const ROOTED = /^(:where\(\.v-dynasty\b[^)]*\)|\.v-dynasty\b|\.v-dynasty-battle\b|\.sheet\.pk-sheet|\.pk-sheet\b|div\.pk-open\b|\.pk-behind\b|html\b|:root|body\b|#stage)/;
function splitSel(s) {
  const out = []; let d = 0, q = null, cur = '';
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--;
    if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out;
}
function rules(src, line = 1, out = []) {
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i) + 2; line += (src.slice(i, e).match(/\n/g) || []).length; i = e; continue; }
    const brace = src.indexOf('{', i);
    if (brace < 0) break;
    const head = src.slice(i, brace);
    if (head.includes('/*')) { const c = src.indexOf('/*', i); line += (src.slice(i, c).match(/\n/g) || []).length; i = c; continue; }
    let d = 0, j = brace;
    for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) break; } }
    const body = src.slice(brace + 1, j), ht = head.trim(), at = line + (head.match(/\n/g) || []).length;
    if (ht.startsWith('@')) { if (/^@(media|container|supports|layer)\b/.test(ht)) rules(body, at, out); }
    else splitSel(ht).forEach(s => out.push({sel: s.trim(), line: at}));
    line += (src.slice(i, j + 1).match(/\n/g) || []).length;
    i = j + 1;
  }
  return out;
}
let bad = 0, n = 0;
for (const f of FILES) {
  for (const r of rules(fs.readFileSync(path.join(root, f), 'utf8'))) {
    n++;
    if (!ROOTED.test(r.sel)) { bad++; console.log(`${f}:${r.line}: not scoped to the Dynasty: ${r.sel}`); }
  }
}
if (bad) { console.log(`FAIL: ${bad} of ${n} Dynasty rules reach outside the Dynasty`); process.exit(1); }
console.log(`PASS: ${n} Dynasty rules, every one scoped to the Dynasty`);
