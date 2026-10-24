# Gridiron Gangbang: rules for working on this app

## All new changes are for Evan's profile only

V3.0 exception (October 22, 2026): Evan explicitly requested all completed updates be released to every user.
Keepfall, the new Return Man presentation/course, game cases, and navigation motion are now shared features.
Keep the scoreboard and picture visibility rules below as they stand (scoreboards, pictures and Keepfall opened to everyone on Oct 24, 2026); `data.isOwner()` still identifies only Evan.
V3 game scoring starts from a clean slate, and Keepfall starts with normal resources, without testing currency.
Do not restore legacy score or Keepfall save fields into the v3 save namespaces.

Standing owner instruction (October 21, 2026): all future app changes, across every feature,
must apply only to Evan Appenzeller's profile unless he explicitly authorizes a wider rollout.
Preserve existing behavior for every other member, app user, guest and unselected profile.
Use the existing stable `data.OWNER === 'evan'` / `data.isOwner()` gate; never match a typed display name.
This app uses local profile selection and anonymous Firebase sessions, not a verified per-person auth UID.
Gate new visuals and asset loads, recheck eligibility after asynchronous work, and clear owner-only state
when the profile changes (including another tab). Do not add owner-only artwork to the shared offline precache.
Verify both owner and non-owner behavior before deploying. These rules also apply to future work outside Return Man.

## Return Man art direction

Evan chose the supplied colorful low-poly runner reference for Return Man's environments: bold silhouettes,
warm cream trim, saturated accents, faceted foliage, clean roads and clearly visible hazards. Keep each of the
nine locations distinct. This direction applies to Evan's profile only. `return-style.js` owns the procedural
ground/sky palettes; `return-scenery.js` adds batched roadside details; `return-3dworld.js` integrates them.
Keep gameplay dimensions and collisions intact, retain the 2D fallback, and preserve the existing City bus art
and its complete loading-failure fallback. Verify `node tools/return/check-environments.cjs`,
`node tools/return/check-city-bus.cjs`, and `node tools/return/check-city-cache.cjs` before further visual releases.

## Scoreboards show everyone

Standing rule from the league's owner (October 24, 2026: "Everyone should be visible on the scoreboards and Keepfall.
No longer shall names be hidden from league members"). It replaces the October 2026 rule that showed only members and
Ryan D to the league:

- **Everyone appears on every phone's scoreboards**: league members, every app user (Ryan Dow "Ryan D", Ryan Stewart
  "Ryan S", anyone added later) and every guest (tagged Guest). Pick'em standings and Keepfall's Visit list too.
- Rows that belong to no one (old test rows) stay hidden, except on the phone that posted them; the duplicate rows in
  `daily.js` `HIDDEN` stay hidden.
- **Profile pictures follow it too**: everyone's picture shows on every phone (the owner, Oct 24 2026).
- **Keepfall's pay ranks against everyone on the board** (the owner, Oct 24 2026): the place paid is the place shown,
  so a guest or an app user above a member lowers what that place pays. A row that is no one's never counts.

How it's enforced, and what to keep doing:

- `js/core/daily.js` `boardShows()` decides what each phone sees; `boardFilter()` applies it to every board doc when
  the snapshot arrives. `LB.raw` and `LB.players` are the filtered board; `LB.all` is every doc.
- Every scoreboard (Daily Puzzles, 17-0, the Two-Minute Drill, Kick It and Return Man, today and week, the
  finished-game cards on the Daily Games list in `js/views/games.js`, and any new game) must read `daily.LB.raw` /
  `daily.LB.players`, never `LB.all`.
- The owner is `js/core/data.js` `OWNER` (`isOwner()`). Visibility no longer depends on it; keep it for his other
  privileges and don't give it to anyone else unless the owner says so.
- App users live in `js/core/data.js` `USERS`; none is set apart from the others (Ryan Dow's old `league: true` is gone).
- The kit check "an app user (Ryan Dow) has a login…" (`js/core/checks.js`) covers the visibility; Keepfall's
  "from the new pay on, Ale for his place…" (`js/core/checks-realm.js`) covers the pay ranking.
- The Pick'em standings (week and season tables, and the leader line built from them) show every row on every phone
  (`js/core/week.js` `finishRows()`). The kit check "Standings show everyone to everyone…" (`js/core/checks-pickem.js`)
  covers it.
- Keepfall (formerly "The Keep" and "The Realm"; `js/views/realm.js`, `js/core/realm.js`) is the owner's alone (October 2026): its
  Daily Games case and links are on his phones only, it raids only the computer's realms, and no one else's scores,
  names or realms appear in it. Exception (Oct 23 2026, the owner: "Users should be able to view other players bases"):
  Visit (`js/views/realm-visit.js`, `core/realm.js` `visitable()`) lets anyone look round other players' realms, read-only
  and never raidable, by the scoreboard rule above (since Oct 24 2026: everyone's realm to everyone). The kit check
  "Keepfall: visiting…" covers it. Don't open it to anyone else unless the owner says so. The kit check "Keepfall: the
  owner's alone…" (`js/core/checks-realm.js`) covers it. Its words (Oct 22 2026): the main building is the Castle,
  the second currency is Ale (Breweries, Cellars); internal ids stay keep/grain/farm/granary and the route #/realm.
- Profile pictures (`js/core/avatars.js` `pictureShows()`): everyone's shows to everyone, a member's, an app user's and a
  guest's. The kit check "pictures: …" covers it.

## Deploying

- Standing owner instruction (October 21, 2026): after completing and verifying requested changes,
  automatically commit and push them through the deployment process below. Evan will give feedback
  on each published update; do not wait for a separate push/deploy confirmation. Include only the
  completed task's changes, preserving unrelated work in progress. Keep the owner-only rollout rule.
- Work on branch `claude/17-0-game-mode`, then fast-forward `main` (the live site).
- Bump `CACHE` in `sw.js` on every deploy.
