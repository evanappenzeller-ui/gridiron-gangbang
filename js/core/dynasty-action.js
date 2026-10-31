// Playing-days photos on the 90+ cards (the owner, Oct 31 2026: "The pictures being used for the legend players are too
// formal ... for any players that are in the 90+ overall club. Find photos of them playing or some sort of playing card
// design"): a freely licensed Wikimedia Commons photo of the player in uniform from his playing days (a game, a Pro Bowl,
// a period trading card), chosen by eye with tools/dynasty/action_photos.py and cropped to img/dynasty/action/<key>.jpg.
// Every card of his rated CLUB or more wears it (core/dynasty.js setData: head 'a:<key>'), in place of a Legend's lead
// photo (core/dynasty-legends.js) or a Live player's headshot; his other cards keep theirs. Like the Legends' photos, his
// card up close credits the author, licence and Commons page, which the licences require.
// ACTION: player key (data/dynasty.json players) -> [file, Commons file name, author, licence, licence URL, year taken].

// <action-photos> (written by tools/dynasty/action_photos.py)
export const ACTION = {
};
// </action-photos>

/** The rating a card needs to wear its player's playing-days photo. */
export const CLUB = 90;
/** A player's playing-days photo (p: his key), '' for none. */
export const actionUrl = p => (ACTION[p] ? `img/dynasty/action/${ACTION[p][0]}.jpg` : '');
/** Its credit: {author, licence, licenceUrl, page (its Wikimedia Commons page), year}, null for none. */
export function actionCredit(p) {
  const r = ACTION[p];
  return r ? {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r[1])}`, year: r[5] || 0} : null;
}
