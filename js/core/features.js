import * as data from './data.js';

// Gridiron Hub v3.0 makes the latest games and visuals available to every player.
// Separate from data.isOwner(), which controls board privacy and owner tools.
export const available = () => true;

// Evan approved the complete Return Man pilot for every player on November 5, 2026.
// This rollout is independent of owner privileges and other games' pilots.
export const returnManUpdated = () => true;

// Gridiron Rivals is everyone's (Nov 10 2026, Evan: "Make the gridiron rivals game mode available to everyone"): every
// league member, app user and named guest plays (the profiles that have a save key: realm-active.js profileKey, as
// Keepfall's core/realm.js mayPlay). A phone that hasn't said who it is has nowhere to save and waits for "Who are you?".
// DYNASTY is the original four-profile preview group (Nov 5 2026), kept for the record; it no longer limits access.
export const DYNASTY = Object.freeze({members: Object.freeze([data.OWNER, 'jayton']), users: Object.freeze(['ryan-stewart', 'ryan-younggreen'])});
/** Whether a profile may play Gridiron Rivals (member: a league member's id; user: an app user, data.user()): anyone with
 *  a profile (a member, an app user or a named guest). */
export const dynastyOpen = (member = data.me(), user = member ? null : data.user()) => {
  if (member) return !data.ids.length || data.ids.includes(member);
  if (user) return data.USERS.some(u => u.id === user.id);
  return !data.me() && !!String(data.guest() || '').trim(); // (this phone's own named guest)
};
// Every Rivals update goes to everyone who plays (Nov 10 2026). No owner/admin privileges or pack/coin entitlements.
export const rivalsUpdated = () => dynastyOpen();
// Friend (multiplayer) battles are paused for everyone (Nov 6 2026, Evan: "Remove the multiplayer battles while we figure
// out the gameplay"). Their entry points, badges and routes hide; saved matches stay on the board untouched, so turning
// this back on brings them back as they were. Solo is unaffected.
export const rivalsVersus = () => false;
/** Whether a saved profile key (m_<member>, u_<app user>, g_<guest>: realm-active.js profileKey) is a Rivals player's:
 *  any league member, app user or guest (Nov 10 2026). */
export const dynastyKey = key => {
  const k = String(key || ''), id = k.slice(2);
  if (!id) return false;
  if (k.startsWith('m_')) return !data.ids.length || data.ids.includes(id);
  if (k.startsWith('u_')) return data.USERS.some(u => u.id === id);
  return k.startsWith('g_');
};
// Unlimited packs (Evan, Oct 29 2026: "Give Ryan Stewart and I unlimited packs to open") are gone for everyone (Nov 10
// 2026, Evan: "Remove the unlimited packs for everyone"): every Dynasty buys, earns or is given its packs. Packs already
// held stay; the open-without-holding path (core/dynasty.js open's free) stays for the kit checks alone.
export const PACKS_UNLIMITED = Object.freeze({members: Object.freeze([]), users: Object.freeze([])});
export const packsUnlimited = key => PACKS_UNLIMITED.members.some(m => key === 'm_' + m) || PACKS_UNLIMITED.users.some(u => key === 'u_' + u);

// Jayton's unlimited Rivals coins (owner-approved Nov 5 2026), independent of unlimited packs and owner tools.
export const coinsUnlimited = key => key === 'm_jayton';
