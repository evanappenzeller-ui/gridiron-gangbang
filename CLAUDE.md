# Gridiron Gangbang: rules for working on this app

## Scoreboards are for the league

Standing rule from the league's owner (October 2026):

- **Only league members appear on the league's scoreboards**, plus **Ryan Dow ("Ryan D")**, the one exception.
- **Guests never appear on anyone else's scoreboard.** A guest still sees their own scores on their own phone
  (tagged Guest, ranked among the league), and no one else sees them.
- **Any other app user (Ryan Stewart, "Ryan S", and anyone added later)** is treated the same way: visible only on
  their own phones.
- Rows that belong to no one (old test rows) are hidden the same way.

How it's enforced, and what to keep doing:

- `js/core/daily.js` `boardShows()` decides what each phone sees; `boardFilter()` applies it to every board doc when
  the snapshot arrives. `LB.raw` and `LB.players` are the filtered board; `LB.all` is every doc.
- Every scoreboard (Daily Puzzles, 17-0, the Two-Minute Drill and Kick It, today and week, and any new game) must read
  `daily.LB.raw` / `daily.LB.players`, never `LB.all`.
- App users live in `js/core/data.js` `USERS`. A new app user is hidden from the league by default. Only an entry
  marked `league: true` shows to everyone, and only Ryan Dow has it. Don't add it to anyone else unless the owner
  says so.
- The kit check "an app user (Ryan Dow) has a login…" (`js/core/checks.js`) fails if this changes.
- Profile pictures follow the same rule (`js/core/avatars.js` `pictureShows()`): a member's picture, and Ryan D's, shows
  to everyone; a guest's or any other app user's only on their own phones. The kit check "pictures: …" covers it.

## Deploying

- Work on branch `claude/17-0-game-mode`, then fast-forward `main` (the live site).
- Bump `CACHE` in `sw.js` on every deploy.
