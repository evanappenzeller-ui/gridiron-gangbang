import * as data from './data.js';

// Gridiron Hub v3.0 makes the latest games and visuals available to every player.
// Separate from data.isOwner(), which controls board privacy and owner tools.
export const available = () => true;

// Gridiron Dynasty is Evan's and Ryan Stewart's alone (Evan, Oct 28 2026: "Make available to Evan and Ryan Stewart's
// profiles only"): by their stable ids, his member id and Ryan Stewart's app-user id (data.js USERS), never a typed name.
export const DYNASTY = Object.freeze({members: Object.freeze([data.OWNER]), users: Object.freeze(['ryan-stewart'])});
/** Whether a profile may play Gridiron Dynasty (member: a league member's id; user: an app user, data.user()). */
export const dynastyOpen = (member = data.me(), user = member ? null : data.user()) =>
  member ? DYNASTY.members.includes(member) : !!user && DYNASTY.users.includes(user.id);
/** Whether a saved profile key (m_<member>, u_<app user>: realm-active.js profileKey) is one of theirs. */
export const dynastyKey = key => DYNASTY.members.some(m => key === 'm_' + m) || DYNASTY.users.some(u => key === 'u_' + u);
// Unlimited packs (Evan, Oct 29 2026: "Give Ryan Stewart and I unlimited packs to open"): their Dynasties open any pack
// without buying it or holding one, by the same ids. A saved profile key (m_<member>, u_<app user>).
export const PACKS_UNLIMITED = Object.freeze({members: Object.freeze([data.OWNER]), users: Object.freeze(['ryan-stewart'])});
export const packsUnlimited = key => PACKS_UNLIMITED.members.some(m => key === 'm_' + m) || PACKS_UNLIMITED.users.some(u => key === 'u_' + u);
