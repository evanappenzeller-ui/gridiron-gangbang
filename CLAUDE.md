# Gridiron Gangbang: rules for working on this app

## All new changes are for every user

Standing owner instruction (October 25, 2026, Evan: "Push all changes to every user. This is the standard from here on
out unless I say otherwise"): every new change ships to everyone (league members, app users, guests and unselected
profiles), not behind the owner gate. It replaces the October 21, 2026 rule that kept new changes on Evan's profile
only. Ship a change to his profile alone only when he says so for that change. The Lay's player matching (Kyren vs Kyle
Williams) and the Live tab, first released to him alone on Oct 25, went to everyone the same day.
Verify behavior on Evan's profile and on another member's (and a visitor's where it matters) before deploying.
`data.isOwner()` / `data.OWNER === 'evan'` still identifies only Evan, for his own privileges (e.g. editing anyone's
Lay leg) and anything he asks to keep his; never match a typed display name.

V3.0 exception (October 22, 2026): Evan explicitly requested all completed updates be released to every user.
Keepfall, the new Return Man presentation/course, game cases, and navigation motion are now shared features.
Keep the scoreboard and picture visibility rules below as they stand (scoreboards, pictures and Keepfall opened to everyone on Oct 24, 2026).
V3 game scoring starts from a clean slate, and Keepfall starts with normal resources, without testing currency.
Do not restore legacy score or Keepfall save fields into the v3 save namespaces.

## Return Man art direction

Evan chose the supplied colorful low-poly runner reference for Return Man's environments: bold silhouettes,
warm cream trim, saturated accents, faceted foliage, clean roads and clearly visible hazards. Keep each of the
nine locations distinct. This direction applies to Evan's profile only. `return-style.js` owns the procedural
ground/sky palettes; `return-scenery.js` adds batched roadside details; `return-3dworld.js` integrates them.
Keep gameplay dimensions and collisions intact, retain the 2D fallback, and preserve the existing City bus art
and its complete loading-failure fallback. Verify `node tools/return/check-environments.cjs`,
`node tools/return/check-city-bus.cjs`, and `node tools/return/check-city-cache.cjs` before further visual releases.

Unity-pack scenery (October 25, 2026, Evan: "use the assets to create new and improved sceneries in the game"):
eight places (all but the stadium) also use models from his packs in D:\Unity\My project\Assets (Western, Desert,
Winter, Tropical Beach/Island, Sci-Fi City, Spaceships, Environment, Playground, Currency).
`tools/return/scenery-models.json` picks them and sizes them; `tools/return/scenery-models.mjs` (with
`unity-assets.mjs`: FBX/OBJ/PNG/PSD/.mat readers, no Unity needed) bakes each face's colour and writes
`models/return/<place>-v1.glb` (give changed output a new version number). `return-models.js` loads a place's GLB as
the run nears it and places the models (roadside, extras, and the in-lane kinds it re-skins inside their exact
collision boxes); without them the world falls back to its procedural shapes.

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
- Gridiron Dynasty (Oct 27 2026, the owner's card game after Madden's Ultimate Team and MLB The Show: `js/core/dynasty.js`,
  `js/views/dynasty.js`, cards from `tools/dynasty/build.py` → `data/dynasty.json`; its battles, Pokémon TCG Pocket's rules
  with the cards, multiplayer only, in turns like chess: `js/core/dynasty-battle.js` the rules, `js/core/dynasty-match.js`
  the matches, `js/views/dynasty-battle.js` the screen; its look and play match Pocket's app, Oct 28 2026: "I want the
  gameplay and theme/design to match the Pokémon app": Pocket's light theme in `css/views/dynasty.css`, the Energy Zone with
  the next energy, Items, pack points; Solo against the computer, Oct 29 2026: `js/core/dynasty-solo.js`, kept on the
  phone, paid once through `paySolo`, never trophies; Pocket's title screen on entering, Oct 29 2026: "Create a start
  screen when entering the dynasty", `views/dynasty.js` `startHTML`, cards drifting, the logo, Tap to Start, with the
  five tabs at the foot incl. the Menu (≡), the header's pack and coin counters, the Packs stage and the Battle banner
  after his Pocket screenshots; verify `node tools/dynasty/check-start-browser.cjs` before Dynasty visual releases (and `node tools/dynasty/check-scope.cjs`: its
  stylesheets share the pk- prefix with the Pick'em and must stay scoped to the Dynasty's roots);
  a pack's cards revealed by rarity, Oct 29 2026: "The more rare the player, the more exciting the animation",
  `views/dynasty-open.js` `REVEAL`/`revealOf`, ◆ dealt to ♛ with the crown, rays, flash, sparks and confetti, verify
  `node tools/dynasty/check-reveal.cjs`):
  Evan's and Ryan Stewart's alone (Oct 28 2026: "Make available to
  Evan and Ryan Stewart's profiles only"). `js/core/features.js` `DYNASTY` / `dynastyOpen()` / `dynastyKey()` hold it, by
  his member id and Ryan Stewart's app-user id (`ryan-stewart`), never a typed name: the Daily Games case (`games.js`
  ONLY), the routes, `mayPlay()` (saving), who can be challenged and the board all go by them. Don't open it to anyone
  else unless he says so.
  Each profile's save rides on its board doc as `dy1[profileKey]`, its side of each battle as `dyb[profileKey][matchId]`;
  its Dynasty board, who can be challenged and the other side of a battle read `daily.LB.raw` (`others()`, `list()`),
  never `LB.all` (that only finds your own saved copies, as Keepfall does). Its coins come from the Daily Games' results
  on your board docs (`earnedOf`). The kit checks "Gridiron Dynasty…" (`js/core/checks-dynasty.js`) cover it.
- Under Keepfall's case on Daily Games, the pictures and names of everyone active in Keepfall today (Oct 26 2026, the
  owner: "Add league member profile pictures to show those that were active today", then "Insert the names below the
  case not on it"): `js/core/realm-active.js` `activeToday()`
  reads each realm's last change (`fr3[key].at`) from `daily.LB.raw`, so it follows this rule. The kit check
  "Keepfall: who was active today…" covers it.

## Keepfall asset refresh: preserve current progress

Evan approved upgrading the existing Keepfall in phases using the Unity assets
in D:\Unity\My project\Assets. Preserve every player's current progress.
Art imports must keep existing building IDs, footprints, levels, balances,
training queues/timers, armies, heroes, hatchery species/colors, trophies and
raid history. Keep the current gg-v3-fr1 profile keys, fr3 remote records and
gridiron-hub-v3 reset marker. A graphics release must never start a new season
or reset a realm. Any later schema change needs a versioned, repeatable migration
with a preserved original save and tests for members, app users and guests.

Keepfall is fully 3D (Evan, Oct 25 2026: "this game should be all 3d from here on out"): terrain and scenery
(views/realm-world.js), every building (realm-buildings.js, models/realm/world-v1 + buildings-v1), walls, soldiers,
villagers, guards, heroes and dragons are models. Never bring back building/army pictures or the painted landscape;
a missing model falls back to realm-models.js plain 3D geometry. Converters: tools/realm/convert-world.mjs and
convert-western.mjs. Reworked designs (Evan, Oct 26 2026: "The low level buildings need more detail. They are too small
and hard to tell what they are"): views/realm-lowlevel.js rebuilds the low stages (and the later ones that would
otherwise look smaller) from those models' own materials and meshes, each filling its lot round a landmark (mine wheel,
copper kettle, gold dome, cask door, pavilion, dragon horns, cauldron gantry; the Barracks' tower over a drill yard).
realm-buildings.js swaps them in only when that stage's imported model loaded, so the plain-3D fallback still stands. Verify tools/realm/check-buildings-browser.cjs, check-world.cjs, check-ui-3d.cjs and
check-spread.cjs before Keepfall visual releases.

The country round the lot (Evan, Oct 26 2026: "They should not overlap unless it is natural looking") is laid
out through realm-world.js roomOf(): every piece has a footprint (FOOT, from the world-v1 manifest) and goes only
where it has room; only natural meetings are allowed (tree crowns, undergrowth under trees and against walls, fence
rails, the ruined keep's walls). A new scenery model needs its FOOT entry; check-world.cjs asserts no faults.

## Rivals refresh (October 30, 2026)

The owner approved the card-game redesign after asking for easier navigation, better cards and more enjoyable play.
The visible name is Gridiron Rivals; keep the existing `dynasty` routes, collection IDs, save keys and access boundary.
Four labeled tabs (Play, Cards, Decks, Packs) replace the five icon-only tabs; Menu is in the header. Keep the title
screen and pack-opening flow. Collectible cards use clear portraits and names; original scans stay in card details.
Matches show readable game pieces and inline attacks. New matches explicitly use rules v3: signature attacks spend
one matching energy and Juke reduces signature damage by 30. Preserve v1/v2 saved matches and unversioned defaults.
Air Raid and Ground Control presets only use owned cards; no collection reset or free-card grant.
Rarity finishes follow the owner's card references: type-tinted silver Common, gold Rare, violet/cyan Epic,
illuminated gold Legendary, and prismatic cosmic Mythic. Keep the name/HP header and framed artwork readable.
`dynasty-rarity.css` and `img/rivals/` own the materials; `dynasty-foil.js` adds reflections in details and reveals.
Collection previews stay still, with reduced-motion support. Verify `check-card-layout.cjs`.
Verify the existing Dynasty checks plus `check-rivals-rules.cjs`, `check-rivals-decks.cjs` and `check-rivals-battle.cjs`.

## Deploying

- Standing owner instruction (October 21, 2026): after completing and verifying requested changes,
  automatically commit and push them through the deployment process below. Evan will give feedback
  on each published update; do not wait for a separate push/deploy confirmation. Include only the
  completed task's changes, preserving unrelated work in progress. Ship to every user (the rule above).
- Work on branch `claude/17-0-game-mode`, then fast-forward `main` (the live site).
- Bump `CACHE` in `sw.js` on every deploy.
