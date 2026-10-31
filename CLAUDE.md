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
Matches show readable game pieces and inline attacks. Rules v3: signature attacks spend one matching energy and Juke
reduces signature damage by 30. Preserve v1/v2/v3 saved matches and unversioned defaults.
Air Raid and Ground Control presets only use owned cards; no collection reset or free-card grant.
Rarity finishes follow the owner's card references: type-tinted silver Common, gold Rare, violet/cyan Epic,
illuminated gold Legendary, and prismatic cosmic Mythic. Keep the name/HP header and framed artwork readable.
`dynasty-rarity.css` and `img/rivals/` own the materials; `dynasty-foil.js` adds reflections in details and reveals.
Collection previews stay still, with reduced-motion support. Verify `check-card-layout.cjs`.
Team backgrounds (October 30, 2026): the owner replaced hometown photos with electric sports-poster graphics,
inspired by his Ravens/Vikings examples. Every franchise uses its own local logo, team colors, nickname, plasma
texture and angled accents (`views/dynasty-team-scenes.js`, `img/rivals/team-graphics-v2/`).
Use the card's team, including historical series, in collectible faces, team Stadiums and battle cards.
Rarity still controls the frame/foil; portraits and readable game panels stay separate. Keep unknown-team and
failed-portrait fallbacks. Artwork loads/caches on demand. The Rivals Menu links the artwork credits page;
logo provenance is in `sources.json` and the generated texture prompt in `tools/dynasty/team-graphics-prompt.txt`.
Verify `node tools/dynasty/check-team-scenes.cjs` with card-layout and existing Dynasty checks.
Card-table battles (Oct 30 2026, the owner: "The gameplay is far too confusing. I want it to include the cards that are
in play laid out and the available cards in your hand are spread out at the bottom. Clicking on each card will show the
attacks and allow the player to choose which one or put the card back down. Energy is automatically added to the cards
each round"; everyone who has Rivals gets it): `views/dynasty-battle.js` lays both lineups out as cards on the felt and
fans the whole hand along the foot (sized by screen height so felt, hand and bar fit a phone). Tapping any card lifts
it (`focusHTML`): your active player's plays (cost, damage, what's still missing), Send in / Switch out, a hand card's
play, setup's lineup choices (a lineup is suggested), the other side's plays to read; Put back sets it down. Hand
indexes stay the cards' identity, so duplicates stay apart. New matches (solo and friend) use rules v4
(`B.RULES_VERSION`): the turn's energy attaches itself as the turn starts (`autoEnergy`: the active player while it
helps his signature play, else the bench player it brings nearest his; after a knockout, the one sent in). A v1-v3
match keeps attaching by hand (Give energy on the lifted card).
Solo is a 30-game ladder against the computer (Oct 30 2026, the owner: "focused on games against the cpu getting
increasingly difficult. The beginning stage should be very easily ... around 15-20 games in there is a noticeable
difference, where strategy must be applied to win"): `core/dynasty-solo.js` `STAGES` g1-g30 in six tiers, each won
game unlocking the next (progress is the save's Solo wins, `s.so.g<n>`). Early decks are low-rated and weak to your
deck's main type and the computer slips; from game 16 (Pro) decks counter your main type and the computer plays
Trainers, switches and hunts knockouts (`skillOf`); Legends from 22. A win pays `D.ladderPay(n)` (double the first
time, packs every fifth game). Keep the twelve earlier opponents readable so an old battle still finishes.
Resolved play events drive the skippable stadium scenes; animations never submit moves or resolve damage.
Queue opponent scenes while a details sheet is open; clear presentation on profile changes or leaving the battle.
The shared card reverse uses a royal blue frame, textured teal/cream swirl, copper football and mirrored wordmarks.
The case's booklet matches the pastel start screen, floating cards and yellow/blue logo (`dynasty-book-v4`);
the disc keeps its restrained navy, ivory and silver artwork (`dynasty-disc-v3`).
Card details retain standard 63:88 proportions; printed attacks and stats use compact spacing and smaller damage
numbers while keeping rarity frames, team scenery, portrait credits and small-card behavior intact.
Verify the existing Dynasty checks plus `check-rivals-rules.cjs`, `check-rivals-decks.cjs` and `check-rivals-battle.cjs`
(the kit check "Gridiron Rivals Solo ladder…" covers the ladder's decks, moves, unlocking and pay).
Legends' photos (Oct 31 2026, Evan: "Import into game for me to see"): each Legend's freely licensed Wikipedia lead photo
is his card's portrait (`js/core/dynasty-legends.js` PHOTO, `img/dynasty/legends/`, head `w:<key>`, beside its team scenery);
his card details credit the author, licence and Commons page, which the licences require: keep the credit. Rebuild with
`tools/dynasty/legend_photos.py` (TITLE/FILE/SKIP/CROP for fixes; check the crops by eye). Legends without one keep their
number. The kit check "Gridiron Rivals: the Legends' photos…" covers it.

## Live league scores (October 30, 2026)

The owner asked for live scores in the app; everyone gets them. They live on the Scores tab (Oct 30 2026, the owner: "The
live league matchups should go in the scores tab and can be toggled between with the nfl matchups in the same fashion as
the pick em screen"): under its title, Pick'em's scoreboard buttons switch NFL and League (`js/views/live.js`, the
choice remembered as `gg-live-mode`); League (`js/views/live-league.js`) is this week's matchups, each side's live score
once its players kick off, and a game's sheet both lineups slot by slot. Matchup no longer lists "This week's games" (Oct 30
2026, the owner: "Remove this from the matchups tab"). `js/core/fantasy-live.js`
scores Yahoo's starters (`seasons[].rosters` slots, with `week`; BN/IR sit) from ESPN's box scores (`core/gameday.js`
`parseBox`, which also reads kickers, defenses and two-point conversions) in Yahoo's standard scoring. It is unofficial:
Yahoo's final (the sync) replaces it. Each side's projected total sits under its score (Oct 30 2026, the owner: "Add total
point projections"): Yahoo gives only the team's projection (schedule `pa`/`pb`, not moved by results), so
`fantasy-live.js` shares it among the starters (position and `data/nfl-players.json` relevance, `gameday.rankOf`) and
counts points scored plus each share for the time left in his game; before kickoff it is Yahoo's number. Each side's chance to win sits beside its score, green for the favourite and red
for the other (Oct 31 2026, the owner: "Add a percentage to the win probability for each matchup. Use green and red"):
`fantasy-live.js` `winChance()`, the projected margin against what's left to score; hidden once a game is over. The Yahoo sync also runs as each game-day window kicks off so the lineups are the
locked ones. The week's Matchup of the Week leads League's list in its own gold card (Oct 31 2026, the owner: "Be sure to highlight
the matchup of the week"): the league's vote (`week.leader`, as the Matchup tab), "Leading the vote" until kickoff locks it;
no card while nobody has voted. Verify `node tools/matchup/check-live-browser.cjs` and the kit check "Live league scores…".

## Home screen (October 30, 2026)

The owner asked: "Make the games tab the main home page of the app. The top should have a bold writing of today's date
and the bottom should be a grid style of all the different tabs. Kinda like how the apps are on my homepage." Everyone
gets it. Daily Games' root (`js/views/puzzles.js`) titles itself with today's date (weekday over month and day, `fitDate`
keeps it on one line) and ends with `appsHTML()`: every other tab as an app icon (`data-go-tab`, opened by `app.js`'s
`slideTo`; `updateBadges` lights their dots). While it shows, `html.is-home` hides the tab bar (`css/views/puzzles.css`);
every other screen keeps the bar. The apps wear the bar's theme, no colours of their own (Oct 30 2026, the owner: "Remove the
colors from the apps and use the navigation bar theme"; this replaced the coloured app squares in the bar too, so the bar is
plain outline/filled glyphs again, a house for Daily Games). Leaving and coming home the icons fly between the grid and the
bar. The shell owns this handoff (`core/home-navigation.js`): start after the destination loads, alongside the 240ms page
slide, then reconcile `html.is-home` and remove stand-ins when the visible route commits. Use only transform/opacity on
moving surfaces, without backdrop blur; reduced motion and clipped grids skip the flight. Hidden view mount/unmount
must not change the global bar. Rapid taps replace pending destinations; resize/backgrounding clears the transition.
A new tab needs its entry in `APPS` and its icon in the bar. Verify `node tools/puzzles/check-home-browser.cjs` and
`node tools/puzzles/check-home-transition.cjs` (slow loads, rapid taps, cancellation, resize, reduced motion and Back).

## Deploying

- Standing owner instruction (October 21, 2026): after completing and verifying requested changes,
  automatically commit and push them through the deployment process below. Evan will give feedback
  on each published update; do not wait for a separate push/deploy confirmation. Include only the
  completed task's changes, preserving unrelated work in progress. Ship to every user (the rule above).
- Work on branch `claude/17-0-game-mode`, then fast-forward `main` (the live site).
- Bump `CACHE` in `sw.js` on every deploy.
