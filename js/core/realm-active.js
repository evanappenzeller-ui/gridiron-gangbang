// Who was in Keepfall today (Evan, Oct 26 2026: "Add league member profile pictures to show those that were active
// today"): read from the realms each phone saves on the board (fr3, under each profile's own key, its `at` the last time
// it changed), light enough for the Daily Games shelf (views/games.js) to read without loading Keepfall. Who shows
// follows the scoreboards' rule (CLAUDE.md): everyone (members, app users, guests) on every phone, from the board as
// this phone may see it (daily.LB.raw). core/realm.js takes its profile keys, TEST_RESET and visitWho from here.
// Exports: TEST_RESET, profileKey(), visitWho(key, doc), activeToday(docs, now) → [{key, name, member, guest, me, at}].
import * as daily from './daily.js';
import * as data from './data.js';

/** The realms of the current season (Gridiron Hub v3) carry this reset marker; older saves don't count. */
export const TEST_RESET = 'gridiron-hub-v3';
/** The key this phone's realm saves under: m_<member>, u_<app user>, g_<the guest's name, its letters in hex>. */
export function profileKey() {
  const member = data.me(), user = data.user();
  if (member) return 'm_' + member;
  if (user) return 'u_' + user.id;
  const guest = data.guest();
  return guest ? 'g_' + Array.from(guest.trim().toLowerCase()).map(c => c.codePointAt(0).toString(16)).join('_') : '';
}
const guestName = key => { try { return key.slice(2).split('_').map(h => String.fromCodePoint(parseInt(h, 16))).join(''); } catch (_) { return ''; } };
/** Who profile key belongs to, as this phone may show them ({name, full?, member?, guest?}), or null when they're not
 *  to show here (a guest's realm only from a guest's own doc). */
export function visitWho(key, doc) {
  const id = String(key || '').slice(2);
  if (key.startsWith('m_')) return data.M[id] ? {name: data.name(id), member: id} : null;
  if (key.startsWith('u_')) { const u = data.USERS.find(x => x.id === id); return u ? {name: u.board || u.name, full: u.name} : null; }
  if (key.startsWith('g_') && doc && doc.g) {
    const nm = guestName(key), nick = String(doc.nick || '').trim();
    return nm ? {name: nick.toLowerCase() === nm ? nick : nm, guest: true} : null;
  }
  return null;
}
const midnight = now => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Everyone whose realm changed today (since local midnight), you among them: the latest first. */
export function activeToday(docs = daily.LB.raw || [], now = Date.now()) {
  const from = midnight(now), own = profileKey(), best = new Map();
  for (const p of docs) {
    const all = p && p.fr3;
    if (!all || typeof all !== 'object') continue;
    for (const key of Object.keys(all)) {
      const s = all[key], at = Number(s && s.at) || 0;
      if (!s || s.rs !== TEST_RESET || at < from || at > now + 60e3 || (best.has(key) && best.get(key).at >= at)) continue;
      const who = visitWho(key, p);
      if (who) best.set(key, {key, name: who.name, member: who.member || null, guest: !!who.guest, me: key === own, at});
    }
  }
  return [...best.values()].sort((a, b) => b.at - a.at || a.name.localeCompare(b.name));
}
