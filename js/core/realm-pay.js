// What a day's place pays in Keepfall (core/realm.js re-exports these and pays by them): Ale for your place on the day's
// board in the ranked games, which the Daily Games boards show next to each place too (views/games.js). Kept on its own
// so the boards needn't load Keepfall. Owner: KEEP.
/** The games that pay Ale by your place on their board. */
export const RANKED = ['puzzles', '17-0', 'drill'];
/** Ale for a day's place (index place - 1; 7th or lower, having played at all, the last). */
export const ALE_BY_PLACE = Object.freeze([5000, 4000, 3200, 2600, 2100, 1700, 1200]);
export const aleFor = place => (Number.isInteger(place) && place >= 1 ? ALE_BY_PLACE[Math.min(place, ALE_BY_PLACE.length) - 1] : 0);
