# Gridiron Gangbang: rules for working on this app

## Scoreboards are for the league

Standing rule from the league's owner (October 2026):

- **Only league members appear on the league's scoreboards**, plus **Ryan Dow ("Ryan D")**, the one exception.
- **Guests never appear on anyone else's scoreboard** (except the owner's, below). A guest still sees their own scores
  on their own phone (tagged Guest, ranked among the league), and no other league member sees them.
- **Any other app user (Ryan Stewart, "Ryan S", and anyone added later)** is treated the same way: visible only on
  their own phones.
- Rows that belong to no one (old test rows) are hidden the same way.
- **The league's owner (Evan) sees every user** (October 2026): on his phones every guest's and app user's scores,
  Pick'em rows and pictures show; the rest of the league still sees only members and Ryan D. A scoreboard row that
  belongs to no one stays hidden on his phones too (Pick'em can't tell a guest's row from no one's, so he sees all of those).

How it's enforced, and what to keep doing:

- `js/core/daily.js` `boardShows()` decides what each phone sees; `boardFilter()` applies it to every board doc when
  the snapshot arrives. `LB.raw` and `LB.players` are the filtered board; `LB.all` is every doc.
- Every scoreboard (Daily Puzzles, 17-0, the Two-Minute Drill, Kick It and Return Man, today and week, the
  finished-game cards on the Daily Games list in `js/views/games.js`, and any new game) must read `daily.LB.raw` /
  `daily.LB.players`, never `LB.all`.
- The owner is `js/core/data.js` `OWNER` (`isOwner()`); `boardShows()`, `pictureShows()` and `week.js` `finishRows()`
  honor it. Don't give it to anyone else unless the owner says so.
- App users live in `js/core/data.js` `USERS`. A new app user is hidden from the league by default. Only an entry
  marked `league: true` shows to everyone, and only Ryan Dow has it. Don't add it to anyone else unless the owner
  says so.
- The kit check "an app user (Ryan Dow) has a login…" (`js/core/checks.js`) fails if this changes.
- The Pick'em standings (week and season tables, and the leader line built from them) follow the same rule:
  `js/core/week.js` `finishRows()` drops any row that isn't a member's, Ryan D's or this phone's own. The kit check
  "Standings show league members and Ryan D to everyone…" (`js/core/checks-pickem.js`) covers it.
- The Franchise (`js/views/franchise.js`, `js/core/franchise.js`) follows it too: its League list ranks franchises from
  `daily.LB.raw`, and only the league's (members and Ryan D) can be raided, and only by the league; guests and other app
  users raid only the computer's franchises. The kit checks "Franchise (THE RULE)…" (`js/core/checks-franchise.js`) cover it.
- Profile pictures follow the same rule (`js/core/avatars.js` `pictureShows()`): a member's picture, and Ryan D's, shows
  to everyone; a guest's or any other app user's only on their own phones. The kit check "pictures: …" covers it.

## Deploying

- Work on branch `claude/17-0-game-mode`, then fast-forward `main` (the live site).
- Bump `CACHE` in `sw.js` on every deploy.
