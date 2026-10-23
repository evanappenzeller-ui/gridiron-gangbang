// v3 scores cannot be restored or overwritten by a phone still running an older release.
export const SCORE_RELEASE = 'v3';
export const SCORE_RESET_AT = Date.parse('2026-10-23T05:04:35Z');
export const SCORE_MAPS = ['days', 's17', 'dr5', 'kk1', 'rm2'];
const SCORE_FIELDS = new Set([...SCORE_MAPS, 'total', 'played', 'last']);
const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
export function readScores(p) {
  const out = {...p}, scores = object(p && p.scoresV3);
  for (const key of SCORE_MAPS) out[key] = object(scores[key]);
  for (const key of ['total', 'played', 'last']) out[key] = Number(scores[key]) || 0;
  return out;
}
export function writeScores(body) {
  const out = {}, scores = {};
  for (const [key, value] of Object.entries(body)) {
    if (SCORE_FIELDS.has(key)) scores[key] = value;
    else out[key] = value;
  }
  if (Object.keys(scores).length) out.scoresV3 = scores;
  if ('total' in body) out.total = body.total; // Required by the existing Firestore rules.
  return out;
}
export const scoreFields = fields => fields.flatMap(key => SCORE_FIELDS.has(key)
  ? key === 'total' ? ['scoresV3.total', 'total'] : ['scoresV3.' + key] : [key]);
export function clearRetiredScores(storage) {
  try {
    storage = storage || globalThis.localStorage;
    if (!storage) return;
    const retired = /^(?:gg-daily-\d+(?:-test)?|gg-(?:17|2m|drill[2-5]|kick1|ret1)(?:-test)?|gg-drill-resets|gg-(?:nfl|cfb)picks-\d{4}-w\d+)$/;
    const keys = Array.from({length: storage.length}, (_, n) => storage.key(n));
    keys.filter(k => retired.test(k || '')).forEach(k => storage.removeItem(k));
  } catch (_) {}
}
clearRetiredScores();
