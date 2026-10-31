// The Legends' photos in Gridiron Rivals (the owner, Oct 31 2026: "Import into game for me to see"): each Legend's
// Wikipedia lead photo where it's freely licensed (Wikimedia Commons), cropped round his face by
// tools/dynasty/legend_photos.py as img/dynasty/legends/<file>.jpg. The photo is his card's portrait (core/dynasty.js
// setData: head 'w:<key>'); his card up close credits its author and licence (views/dynasty.js photoCredit).
// PHOTO: player key (data/dynasty.json players) -> [file, Commons file name, author, licence, licence URL].

// <legend-photos>
export const PHOTO = {};
// </legend-photos>

/** A Legend's photo (p: his key), '' for none. */
export const legendUrl = p => (PHOTO[p] ? `img/dynasty/legends/${PHOTO[p][0]}.jpg` : '');
/** Its credit: {author, licence, licenceUrl, page (its Wikimedia Commons page)}, null for none. */
export function legendCredit(p) {
  const r = PHOTO[p];
  return r ? {author: r[2], licence: r[3], licenceUrl: r[4], page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r[1])}`} : null;
}
