import * as data from './data.js';

// Gridiron Hub v3.0 makes the latest games and visuals available to every player.
// Separate from data.isOwner(), which controls board privacy and owner tools.
export const available = () => true;

// Evan approved the complete Return Man pilot for every player on November 5, 2026.
// This rollout is independent of owner privileges and other games' pilots.
export const returnManUpdated = () => true;

// Gridiron Rivals (internal name Dynasty): Evan and Ryan Stewart (Oct 28 2026), plus Jayton
// (owner-approved Nov 5 2026). Access follows stable member/app-user ids, never a typed display name.
export const DYNASTY = Object.freeze({members: Object.freeze([data.OWNER, 'jayton']), users: Object.freeze(['ryan-stewart'])});
/** Whether a profile may play Gridiron Dynasty (member: a league member's id; user: an app user, data.user()). */
export const dynastyOpen = (member = data.me(), user = member ? null : data.user()) =>
  member ? DYNASTY.members.includes(member) : !!user && DYNASTY.users.includes(user.id);
/** Whether a saved profile key (m_<member>, u_<app user>: realm-active.js profileKey) is one of theirs. */
export const dynastyKey = key => DYNASTY.members.some(m => key === 'm_' + m) || DYNASTY.users.some(u => key === 'u_' + u);
// Unlimited packs (Evan, Oct 29 2026: "Give Ryan Stewart and I unlimited packs to open"): their Dynasties open any pack
// without buying it or holding one, by the same ids. A saved profile key (m_<member>, u_<app user>).
export const PACKS_UNLIMITED = Object.freeze({members: Object.freeze([data.OWNER]), users: Object.freeze(['ryan-stewart'])});
export const packsUnlimited = key => PACKS_UNLIMITED.members.some(m => key === 'm_' + m) || PACKS_UNLIMITED.users.some(u => key === 'u_' + u);

// Jayton's unlimited Rivals coins (owner-approved Nov 5 2026), independent of unlimited packs and owner tools.
export const coinsUnlimited = key => key === 'm_jayton';
