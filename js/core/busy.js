// What the player is in the middle of right now, for live challenges (core/rivals-live.js): a game view registers a
// getter while it is mounted (Return Man: a run under way), and a challenge waits until that game is done.
const getters = new Map();
/** Register kind's getter (true while busy); returns the function that removes it. */
export function register(kind, fn) {
  const token = {fn};
  getters.set(kind, token);
  return () => { if (getters.get(kind) === token) getters.delete(kind); };
}
/** The first busy kind ('rm' for a Return Man run), or ''. */
export function busy() {
  for (const [kind, t] of getters) { try { if (t.fn()) return kind; } catch (_) {} }
  return '';
}
