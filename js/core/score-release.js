// v3 scores cannot be restored or overwritten by a phone still running an older release.
export const SCORE_RELEASE = 'v3';
export const SCORE_RESET_AT = Date.parse('2026-10-23T05:04:35Z');
// November 5's Return Man replay round only. Separate cloud/local keys keep old clients from restoring its scores.
export const RETURN_REPLAY = Object.freeze({date: '2026-11-05', day: 17, field: '17r1', key: 'gg-v3-ret2', previousKey: 'gg-v3-ret1'});
export const SCORE_MAPS = ['days', 's17', 'dr5', 'kk1', 'rm2'];
const SCORE_FIELDS = new Set([...SCORE_MAPS, 'total', 'played', 'last']);
const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
export function readScores(p) {
  const out = {...p}, scores = object(p && p.scoresV3);
  for (const key of SCORE_MAPS) out[key] = object(scores[key]);
  const returns = {...out.rm2}, replay = returns[RETURN_REPLAY.field];
  delete returns[RETURN_REPLAY.day]; delete returns[RETURN_REPLAY.field];
  if (replay && typeof replay === 'object' && !Array.isArray(replay)) returns[RETURN_REPLAY.day] = replay;
  out.rm2 = returns;
  for (const key of ['total', 'played', 'last']) out[key] = Number(scores[key]) || 0;
  return out;
}
export function writeScores(body) {
  const out = {}, scores = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'rm2') {
      scores.rm2 = {...object(value)};
      if (Object.prototype.hasOwnProperty.call(scores.rm2, RETURN_REPLAY.day)) {
        scores.rm2[RETURN_REPLAY.field] = scores.rm2[RETURN_REPLAY.day];
        delete scores.rm2[RETURN_REPLAY.day];
      }
    }
    else if (SCORE_FIELDS.has(key)) scores[key] = value;
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
