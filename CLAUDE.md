# Gridiron Gangbang: rules for working on this app

## Case scoreboard controls (November 9, 2026)

Keep the shelf cases large. A sibling button sits underneath each case for Evan, using the shelf's
existing bottom space: Scoreboard flips to the board and Front cover flips back. Remove the
new-puzzles/game countdown beneath his cases; the flip control is the only normal footer content. Hide the scoreboard
and its control until someone has played (a board entry or this profile's completed game).
The button is a small translucent pill with a larger touch target, leaving the cover visible.
Keepfall retains its printed back with a Back cover button. November 9 follow-up: remove
the Scoreboard control from Gridiron Rivals. Rivals retains its original printed case back,
with no scoreboard or bottom flip button; its in-game Rankings remain unchanged. No new scoring
or save data.
Verify `check-case-flip.cjs`, home-browser and Rivals preview/access before publishing.

## Rivals first-play tutorial (November 8, 2026)

The four `features.rivalsUpdated()` profiles enter practice after Tap to Start until they
complete or skip it. `core/dynasty-tutorial.js` supplies a disposable v7 practice duel at
`/puzzles/dynasty/battle/tutorial`, rendered by the real Pocket battle view. Its ten guided
actions teach the opening Active/Bench, manual Energy, Supporters, attacks, development,
knockout points and retreat. No menu tour. The scripted twenty-card loaner deal and coach
never read or overwrite a Solo/live match, grant cards, pay rewards or change ladder progress.
The existing save carries optional `tutorial: {v: 1, result: 'completed' | 'skipped'}` per
stable profile key, locally and through its normal cloud sync. Replay lives in How to play;
skipping a replay does not downgrade a completed receipt. An interrupted practice starts
fresh next time. Profile changes and hidden views stop the practice coach, as with Solo.
Verify `check-tutorial.cjs`, `check-tutorial-browser.cjs` (also `--phone` for small-screen
touch and normal motion), Pocket rules/integration/browser, title-screen, scope and access.

## Rivals deck Energy availability (November 7, 2026)

For the four Rivals profiles, the deck builder shows all eight selectable Energy Zone types above the cards.
`core/dynasty-pocket-cards.js` `energyDeck()` tests whether owned matching/Colorless Bases, their available
development forms and reusable supports can form a legal 20-card deck. It respects canonical copy limits and
exact development predecessors without granting cards. Insufficient types remain visible, dark and disabled.
An unsupported choice already in a saved deck stays intact and may be removed, but cannot be selected anew.
Auto-build uses the chosen 1–3 Energy types; changing a checkbox alone never replaces cards or writes a save.
Colorless cards can use any Energy; Colorless and Dragon remain card types rather than new Energy generators.
Verify `check-deck-energy-browser.cjs`, `check-pocket-cards.cjs`, deck-shelf-browser, Pocket integration/browser,
title-screen, preview/access and scope. Browser checks cover all four profiles, sparse inventory, phone/tablet
layouts, rejected unavailable toggles, incomplete drafts, chosen Auto-build and save/reload.

## Rivals visual deck editing (November 7, 2026)

The four `features.rivalsUpdated()` profiles see the actual printed cards in deck details and the editor
(`views/dynasty-pocket-decks.js`). Identical IDs share a tile with a top-left copy tag. A plus slot shows the
number of missing cards out of 20 and opens the collection picker. Move handles support touch/mouse dragging,
tap-then-target and keyboard arrows; duplicate groups move together. Reordering changes only the draft's
existing ordered IDs until Save. Closing or switching profile discards edits. Rental decks stay fixed; ownership,
canonical copy limits, Energy choices, saved matches and collection progress stay unchanged.
Verify `check-visual-decks.cjs`, deck-shelf-browser, Pocket browser/integration, title-screen, preview/access and
scope checks. Visual checks cover phone/tablet layouts, copy tags, empty slots, touch/keyboard, save/reload and cancellation.

## Rivals binder image loading (November 7, 2026)

The four-profile `features.rivalsUpdated()` binder loads each rendered 60-card page's portraits and Energy artwork
eagerly, before scrolling reaches it (`views/dynasty.js` `stackHTML`). Keep `content-visibility` for offscreen paint
savings, append pagination and cached card nodes. Unopened pages remain on demand. Preserve the NFL-to-ESPN and
jersey-number fallbacks. Verify `node tools/dynasty/check-card-images.cjs` for delayed images, fast scrolling,
pagination, cached panes, filtering, unchanged saves and all four profiles (`--baseline` reproduces the pre-fix delay).

## Rivals player headlines and Energy calling cards (November 7, 2026)

The four `features.rivalsUpdated()` profiles see larger, condensed player names at the top of
their cards and illustrated Energy banners directly below. `views/dynasty-energy.js` maps ten
Energy types to versioned, on-demand `img/rivals/energy-banners/*-v1.webp` artwork; legacy Energy
symbols keep their original names and map to matching artwork. The calling-card images are
decorative, with SVG symbols plus a solid-color fallback. November 8 follow-up: banners omit
visible text and are about 20% slimmer, giving the freed height to the player portrait. Full Energy
names remain in the card's accessible label, symbol tooltip and details.
Names wrap in full; HP, rarity finishes, portraits, printed rules and 63:88 proportions remain.
Collection, details, reveals and the current battle use the shared `cardHTML()` face. No rules,
saves, privileges or profile access change. Artwork prompts are in `tools/dynasty/energy-banners-prompts.txt`.
Verify energy-faces, card-layout, binder-energy, Pocket browser/touch/framing/presentation,
title-screen, scope, preview and access before release.

## Rivals deck boxes and Energy card colors (November 7, 2026)

The four `features.rivalsUpdated()` profiles see the Pokémon-inspired My decks shelf in
`views/dynasty-pocket-decks.js`: numbered Energy-colored tiles, dimensional deck boxes with
printed player covers and Energy logos, a saved-deck count, Edit/Done and deck-building help.
The starter rental, 30 custom slots, chosen Energy Zones and 20-card rules stay unchanged.
Browsing and toggling Edit never write saves; editing, selecting and deleting keep existing actions.
Shelf numbers have their own row above the deck box, with space for its raised lid, so both digits
remain visible on phones and tablets. Verify the deck-shelf browser and stylesheet scope checks.

Player faces carry `.pk-energy-card` only for the shared Rivals group. Their paper, name, attack,
weakness and footer panels use the printed Energy color; a large outlined logo and full Energy
name sit on a darker band. Rarity still controls the foil rim and portrait artwork. Colors derive
from the same `dynasty-energy.js` palette as Energy symbols, including old saved-match symbols.
Support cards keep their existing type colors. Verify `check-energy-faces.cjs`, binder-energy,
card-layout, Pocket deck/browser/framing/presentation, title-screen, scope and preview/access checks.

## Rivals battle card framing (November 7, 2026)

The four `features.rivalsUpdated()` profiles get larger v7 Active cards and larger printed attack
names, damage and effects on the table. `dynasty-pocket.css` budgets the usable screen height
between both lineups, the hand and turn controls, preserving 63:88 card proportions. Active HP
sits beside the card; the compact opponent hand and resource piles stay inside the side gutters.
View all and the hand count sit beside End turn, with the existing full-width choice buttons
during a required replacement. The options menu still offers View your hand. Notches, home
indicators and crowded fans keep their space; a turned phone uses the existing portrait lock's
dimensions. Legacy matches, rules, saves and access are unchanged.
Verify `check-pocket-framing.cjs` (dense boards, long hands, phone/tablet sizes and safe areas),
Pocket touch at 320/390, browser/presentation, felt/choices, title-screen, scope and preview/access.

## Rivals binder sorting (November 7, 2026)

The four `features.rivalsUpdated()` profiles default to Overall, highest rating first. Energy type,
Team, Position and Rarity are independent sort options for the whole binder. Energy type groups
by the printed Energy (`PC.card(id).types[0]`); each other grouping uses its selected field, with
Overall as the tie-breaker. Trainers follow players. Search, filters and Show more preserve the
selected order, group counts, copy stacks and existing sort preference. Five labeled sort buttons
wrap on phones to retain their touch targets. No permanent Energy grouping or secondary headings.
Duplicate-count badges remain outside paint containment: the shared Collection binder applies
`content-visibility` to the card inside each stack, keeping its count visible above the frame on Safari.
The player face has a named Energy band with a larger symbol between its header and portrait,
shared by binder, details, reveals and battles. Legacy matches keep their saved Energy semantics;
other profiles retain their existing presentation. No collection or gameplay save changes.
Verify `check-binder-energy.cjs`, title-screen, scope and preview/access for binder sorting changes.
Card-face changes also need card-layout and Pocket browser/touch/presentation checks.

## Rivals Energy logos (November 7, 2026)

The four `features.rivalsUpdated()` profiles see distinct SVG marks for Grass, Fire, Water,
Lightning, Psychic, Fighting, Darkness, Metal and Colorless in place of initials.
`views/dynasty-energy.js` shares the marks across printed cards, attack/retreat costs, attached
Energy, previews, Energy Zones and drag ghosts. Full type names remain accessible; shapes
distinguish types without relying on color. Legacy football Play Call symbols, game rules,
saves and access stay unchanged. The shared SVG module is precached for offline play.
Verify card-layout, Pocket browser/touch/presentation, title-screen, scope and preview/access checks.

## Rivals ability cards (November 7, 2026)

For the four profiles enabled by `features.rivalsUpdated()`, support cards use solid colors by type:
blue Items, purple Coaches/Supporters, bronze Tools and green Stadiums. `trainerHTML()` shares the
printed effect, full name and play-limit footer across collection, reveal and battle faces; deck-builder
support details use that same face. `.pk-ability-card` in `dynasty-rarity.css` keeps descriptions visible
at small sizes and disables rarity artwork, sparkles and foil interaction for these cards only.
Current v7 support wording lives in `dynasty-pocket-cards.js`; legacy faces retain `B.trainerText()`
and the saved match's energy variant. Rules, card IDs, saves and individual privileges are unchanged.
Verify the card-layout, scope, start-browser, preview/access and Pocket catalog/rules/integration checks.

## Rivals card draws (November 7, 2026)

Evan, with a screenshot: "When cards are drawn, they should have an animation and sound effects. Preview the card briefly
before moving it to the players hand" (the Rivals group). In the v7 battle each of your `draw`/`search` events plays a
`draw` scene in `dynasty-pocket-presentation.js`: the card leaves your deck face down, turns over at center (a shine and a
glow in its rarity's colour, "You drew …" pill), holds about 0.7 s, then flies into its place in the fan (read when it
leaves, since the hand is redrawn after the scene starts) and lands with a brief glow; 1.6 s, back-to-back draws share a
scene side by side. Until it lands, the drawn card waits hidden in the fan (`is-incoming`, `presentation.sync()` after
each table render). The opponent's draws slide face down from their deck to their hand (0.7 s); their IDs are dropped
when queued and never reach the page. Cues `deal` (swoosh off the deck), `flip` (snap and chimes) and `card` (landing) in
`core/dynasty-sfx.js`. Tap anywhere or Skip lands it at once; reduced motion, hiding and profile changes clear it as the
other scenes. Presentation only: no rules or save changes. `check-pocket-presentation.cjs` and `check-sfx.cjs` cover it.

## Rivals live battles (November 7, 2026)

Evan: "There should be a list of league members with an active status green dot means they are in the app. A request
sent to them should show up as a push notification on their screen. If they are actively playing return man it will
show up when they are done. This is meant to be a live matchup so both players need to be active for the game to play
out" (the Rivals group). Live battle (Rivals home and Battle tab, `views/rivals-live-lobby.js`) lists the other three
Rivals players: green dot in the app (seen within 100 s and on screen), amber playing Return Man or in a live battle,
grey away. Challenge needs them in the app; it lasts ten minutes. The challenge drops in from the top of any screen
(`views/rivals-live-notice.js`, Accept/Decline) and waits while a Return Man run is under way (`core/busy.js`, which
`views/return.js` registers: modes catch/run/paused) or you're in a live battle. Accepting opens the battle on both
phones (`/puzzles/dynasty/battle/lv…`, the v7 screen fed by `core/rivals-live-match.js`). Both must stay in the app:
when one leaves (off screen, or no beat for 40 s) the other's table pauses with "X left the app"; after two minutes
they may Claim the win. Concede, Rematch. Live battles use the v7 rules and each manager's active deck, pay nothing and
never touch the Solo ladder, trophies or collection.
Sync: no new Firestore rules. Each phone writes only its own board doc's `rlv` field (`core/rivals-live.js`: presence
`k/on/at/b`, sent challenge `i`, answer `r`, its side of the battle `m` with moves `[[n, move]]`), with heartbeats every
45 s (15 s in a battle) and at most one write in flight. The game is `dynasty-pocket.js` replay from the challenge id as
seed with both sides' moves merged by `n` (opening lineups at n = seat). Presence ages use when this phone heard a beat,
never the other phone's clock. Only the four Rivals profiles publish anything. It is not a server push: a phone that
is closed or in the background gets nothing (live play needs both in the app anyway). Verify
`node tools/dynasty/check-live.cjs` (two real browsers on a stand-in board) plus the pocket browser/presentation checks.

## Rivals casino felt (November 7, 2026)

The v7 battle is a single textured felt table with a padded dark rail and brass trim. The existing finish's
`color` fills the table on your turn and its paired `away` color on the opponent's turn, selected from the same
`state` used by the prompt and legal actions (including replacement choices). Choosing your opening lineup and
completed matches use your felt. `dynasty-pocket-battle.js` sets `data-turn` and `data-finish`; `dynasty-pocket.css` paints the table.
Both score badges remain stacked, and End turn stays below the hand. Controls use light text against the felt.
Required promotion/switch choices temporarily replace End turn in that footer, keeping both the score and menu clear.
Battle options → Table finish previews both turn colors. Existing profile-scoped `s.table.finish`, unlock progress,
pack/coin privileges and game saves stay intact: Clubhouse is free; Midnight Club needs 3 solo wins, Royal Box
challenge 10, Red Zone 5 opened packs, and Champions Club 20. No new grants or save migrations.
Verify `check-felt.cjs`, `check-felt-choices.cjs`, Pocket browser, legacy table, title-screen, access/preview and stylesheet scope checks.

## Rivals CPU pacing (November 7, 2026)

The four `features.rivalsUpdated()` profiles get a two-second beat between CPU actions in
current and saved legacy Solo matches. `core/dynasty-solo.js` `watchPlayback()` binds the
visible battle to its match and stable profile; CPU play waits for scenes, previews, hand
inspection, open/closing sheets and backgrounded views. Leaving the battle stops unseen
moves; resuming waits a full beat instead of catching up. Opponent result scenes remain
for at least 2.8 seconds and still support Skip. Reduced motion retains the slower CPU
timing without introducing animations. Rules, seeded decisions, save versions and rewards
are unchanged. Verify `check-cpu-pacing.cjs`, `check-pocket-integration.cjs`, Pocket browser/
presentation and legacy table checks, plus preview/access and stylesheet scope checks.

## Rivals scoreboard placement (November 7, 2026)

Evan, with a screenshot: "The user's scoreboard is hidden behind the cards in the players hand" (the Rivals group). In the
v7 battle your `.rp-manager.is-mine` (name and three knockout-point dots) is a compact two-line tab on the left edge at
60.5% of the arena, between the Stadium and the menu button, clear of the Bench and the fanned hand. The opponent's bar
stays top right. November 7 follow-up: both scoreboards use the same stacked name, spacing and 13px dots, with mirrored
edge corners. End turn now sits in a bottom footer below the fanned hand, alongside space reserved for the sound controls.
Confirm lineup and completed-match actions share that footer. The arena reserves the hand's overhang and footer height;
Bench targets remain at least 44px wide on small phones. Rules and saves are unchanged. `check-pocket-browser.cjs`
asserts both scoreboards are fully uncovered at 320 and 390 widths; also verify `check-pocket-touch.cjs` at both widths.

## Rivals card preview, attack banner, coin toss and Sleep (November 7, 2026)

Evan, with a gameplay video: "the card preview with attack options should match the attached video. Include an attack
animation like the attached with an animation and the name of the attack. Match the coin flip in the attached video.
Sleep should be an option for attacks and the opponent can only wake up if they flip heads" (the Rivals group).
Preview: tapping an athlete on the v7 table opens `.rp-preview` (`views/dynasty-pocket-preview.js`): the printed card
rises, tilted, over the lower table with live HP, Energy and status badges; on your turn your Active's attacks are
glowing banners laid over its printed attacks (cost, name, effect, damage; disabled ones grey with what's missing:
"Needs 1 more Energy", "Asleep"), and a Retreat bar sits on the footer (one Bench target retreats, more opens a chooser).
The banners start under the player's picture and never cover it (Evan: "Move the attacks down so it doesn't cut off the
player picture"); when they need more room they hang below the card, Retreat (with the attached Energy beside it) under
them, and the card rises by that amount (`--rp-pv-below`) so everything stays on screen.
A pressed banner flashes white and the move goes through the battle's `send()`. Tapping outside, Escape or Details
(the old card sheet, keyboard/accessible route) sets it down. Hand cards keep their sheet. The battle builds the model
from `B.legalActions`; the preview decides nothing. Presentation waits while it is open.
Scenes (`dynasty-pocket-presentation.js`): an attack lifts the attacker's printed card to center while a diagonal
banner in its type colour sweeps across with the attack's name and athlete, then it returns, lunges, and the defender
shakes under the damage number (1.8 s, 2.45 s with damage); v7 no longer uses the stadium athletes there (legacy still
does). A new condition shows a white pill ("X is now Asleep"), the card tinted with drifting Z's and a zZ badge.
Coins are tossed toward the camera and spin end over end (rAF, seeded result only), the table tint following the face
showing (warm heads, cool tails), under a "Checkup — Asleep" pill; the landed result names the outcome. Our own coin
faces (football heads, GR tails). Skip/Escape, reduced motion and cleanup as before; nothing resolves moves.
Rules: printed revision `G.rev` inside v7. New solo matches save `rev: 2`; a record without one replays as revision 1
with its original attacks (`attacksV1`) and Sleep clearing, so in-progress matches never change. Revision 2 prints
Sleep attacks (Justin Jefferson's Double Move, C, 10; the Psychic profile's Hard Count, Psychic, 10, replacing Read the
Field) and Sleep ends only on a heads Checkup flip: development and moving to the Bench no longer wake an athlete.
Existing attack indexes stay put. The CPU (level 9+) sleeps an awake defender it can't knock out. Checkup flips carry the
athlete's `id`; heads adds a `wake` event. `B.attacksOf(G, id)`, `C.printed(id, rev)` and `printedCard(id, rev)` give
a match's own attacks. Verify `check-pocket-rules.cjs` (heads-only Sleep, revision 1 replay), `check-pocket-presentation.cjs`
(preview banners/retreat/set down, attack banner, Sleep pill, coin, a real Sleep attack on all four profiles) and
`check-pocket-browser.cjs`, plus the other Rivals checks.

## Rivals rarity scale and NFL headshots (November 7, 2026)

Evan: "adjust the rarity of the cards. Epic is players with ratings 85-89. Legendary is 90-95. Mythic is 96-99. Use the
players official nfl headshots for common and epic cards". `core/dynasty.js` `SCALE` is Epic 85, Legendary 90, Mythic 96
(Common 84 or less); rarity is still by OVR alone, so 80-84 players are now Common (1,404 Common, 116 Epic, 173 Legendary,
47 Mythic players). Pack odds, prices, collections, saves and battle stats are unchanged. Common and Epic cards wear the
player's official NFL.com headshot (`players[key][4]` = `n:<id>` or `n:private/<id>`), with ESPN's id in `players[key][8]`
as the image fallback (`views/dynasty.js` `portraitOf().alt`, `imgFallback`); only Legendary, Mythic and Legend cards wear
action photos (`D.actionRarity`). `tools/dynasty/nfl_heads.py` rewrites only those headshot fields from nflverse (roster
first, then players.csv) and never touches ratings. The kit checks "the cards…" and "action photos…" cover it.

## Rivals hold preview and support flash (November 7, 2026)

Evan, with a gameplay video: "when a user presses and holds onto cards in their hand, there should be a preview of the
card that shows a detailed view of the attacks" and "When an ability card is played, create a flashing animation"
(the Rivals group). Holding a hand card in the v7 battle shows `.rp-hold-preview`, the card's full printed face
(attacks, HP, weakness, retreat), large above the lifted fan; sliding swaps it, and dragging, release, cancel, Escape,
hiding and profile changes remove it (`dynasty-pocket-hand.js`, visual duplicate only, aria-hidden). Each resolved
`support` event (Item, Supporter, Tool, Stadium, yours or the opponent's) plays `.rp-play-flash` in
`dynasty-pocket-presentation.js`: the printed card rises to center, flashes white, bursts into a glowing frame with
sparkles and the `power` cue (1.75 s). Skip/Escape, reduced motion, sheet queueing and cleanup follow the other scenes;
it never resolves moves or changes saves. `check-pocket-touch.cjs` and `check-pocket-presentation.cjs` cover both.

## Rivals Energy drag (November 7, 2026)

Evan: "players should be able to drag and drop the energy onto a card on the table. I don't want to click on the
energy slot and chose the card, it should always be dragged." In the v7 battle the Energy Zone's orb is dragged onto
one of your highlighted athletes (`dynasty-pocket-hand.js` energy gesture; `dynasty-pocket-battle.js` `energyTargets`/
`dropEnergy` send the engine's legal `{a:'energy', on}` move). A pointer tap on the zone only shows a hint toast; card
details no longer offer Attach Energy. Keyboard Enter on the zone keeps the accessible chooser sheet. Invalid drops,
cancelled pointers, hiding, leaving and profile changes attach nothing. Rules, saves and replay are unchanged.
`check-pocket-touch.cjs` (390/320) and `check-pocket-browser.cjs` cover tap, invalid/cancelled/valid drags and keyboard.

## Rivals battle presentation restoration (November 6, 2026)

The v7 battle now uses the approved `img/rivals/card-back-v1.webp` for opening face-down players,
the opponent's hand and both decks. Legacy battle backs use the same artwork. The new arena had
introduced placeholder backs and omitted the existing stadium scenes; `views/dynasty-pocket-presentation.js`
now queues public attack, coin, development and support events for all four `features.rivalsUpdated()` profiles.
It shares `dynasty-battle-athlete.js` with legacy scenes and only displays already-resolved results.
Never resolve a move, reroll a coin, expose hidden draws/searches, or change a save from presentation.
Wait for open and closing sheets; Skip/Escape restores the table. Reduced motion omits the scenes,
and hiding, leaving or switching profiles clears the queue. Loading a saved match never replays old events.
Verify `node tools/dynasty/check-pocket-presentation.cjs`, the pocket browser/integration/rules checks,
legacy table, preview/access, title-screen and stylesheet scope checks before release.

## Rivals card gestures (November 6, 2026)

The v7 table now uses the full collection card faces through `dynasty-pocket-card.js`, with
explicit versioned stats for rental/development forms. Tap a card to center its printed face
and inspect attacks. Hold to lift, slide across the fanned hand to preview, and drag onto
highlighted legal targets. `dynasty-pocket-hand.js` owns pointer capture/cleanup only;
`dynasty-pocket-battle.js` resolves drops through the existing engine legality checks.
Setup placement stays provisional until confirmed. Invalid drops, cancelled pointers, leaving
the route, hiding the page and profile changes never play cards. Keep keyboard actions and
View all available. Run `check-pocket-touch.cjs` at 390 and 320 widths, plus pocket browser,
rules/integration, preview and scope checks. New modules belong in the service-worker cache.

## Rivals portrait arena (November 6, 2026)

The v7 battle view follows Evan's attached gameplay layout: opponent hand and three-slot Bench
above two centered Active athletes, your three-slot Bench and fanned hand below, with deck/discard
piles, Energy Zones and three knockout-point markers around the edges. Cards still use Rivals art.
Drag Energy onto an eligible athlete, View all to inspect a crowded hand, and the circular
Battle options menu for the log, table finish, audio settings and concession. Presentation only:
keep the v7 rules, replay/save format, collection and four-profile access boundary unchanged.
Verify `check-pocket-browser.cjs` for phone geometry and actual play, plus scope and preview checks.

## Rivals card-duel rules (November 6, 2026)

The attached gameplay brief is now the baseline for new Rivals solo battles; its full text is
`docs/rivals/gameplay-brief.txt`. This supersedes the older 40-card table, automatic lineup Energy,
position type matchups, team chemistry, Energy-spending signatures and one-point-for-every-player
rules for NEW matches. `features.rivalsUpdated()` remains the four-profile rollout boundary.
Friend battles remain paused. Existing v1–v6 logs use their original engine, presentation and rewards.

New games save v7 and explicit Energy Zone choices in the existing solo record. The deterministic
`core/dynasty-pocket.js` enforces 20 cards, canonical two-copy limits, one Active/three Bench,
manual Energy, Base/Breakout/Prime development, Items/Supporters/Tools/Stadiums, printed Weakness,
retreat, Checkup and knockout points (regular 1, ex 2, Mega ex 3). Attacks retain Energy unless
their printed effect discards it. Empty decks do not lose; no emergency reserve recruitment or turn cap.
Card stats in `dynasty-pocket-cards.js` are fictional balance designs independent of ratings,
rarity, positions and team. Existing collection cards provide Base designs; matching development
and support playbook cards are explicitly reusable rentals, not permanent collection grants.
A fixed, labeled 20-card development rental lets managers try the rules without owning those cards.
New loadouts live in additive `s.pocket`; `s.table`, old decks, collection, balances, claims and
progress are retained. Boss reward schedule and permanent receipts remain unchanged.

`views/dynasty-pocket-battle.js` renders only v7 records; `dynasty-pocket-decks.js` owns the new
builder and guide. Preserve profile-scoped audio/preferences, artwork credits and table finishes.
Validate `check-pocket-cards.cjs`, `check-pocket-rules.cjs`, `check-pocket-browser.cjs` and
`node --experimental-vm-modules tools/dynasty/check-pocket-integration.cjs`, plus legacy rules,
preview/access, scope, audio and collection checks. Collections and packs retain their existing
economy; trading/sharing and live multiplayer are not added by this gameplay change.

## Standing Rivals updates (November 5, 2026)

Evan explicitly authorized the updated Rivals game and all future Rivals updates for Evan (`evan`),
Jayton Hull (`jayton`), Ryan Stewart (`ryan-stewart`, Ryan S), and Ryan Younggreen
(`ryan-younggreen`, Ryan Y). Use `features.rivalsUpdated()` for Rivals gameplay/presentation,
including Home, card table, deck shelf, boss ladder, pack art/reveals, music and sound effects.
This supersedes Rivals-specific owner-only pilot restrictions. Keep other apps, owner/admin tools,
and individual pack/coin privileges unchanged. Preserve saves and old match versions. Audio
preferences belong to each stable profile key; Evan's existing audio preferences remain intact.
Future Rivals changes go to this four-account group by default unless Evan specifies otherwise.

This standing rollout overrides historical Rivals owner-pilot descriptions below. Existing solo
and friend matches retain their saved rules and rewards; only new solo matches use the shared
v6 table/boss features. No saves, collections, balances, or daily claims are reset. Music and effects
settings use `gg-rivals-{music|sfx}:<profileKey>:v1`, preserving Evan's original m_evan keys.
Verify `check-rollout.cjs`, audio, table, ladder, deck, reveal, start, access, preview and scope checks.

New solo games and friend challenges save `roundEnergy: 2`. After drawing one card if available,
each player in that side’s lineup gets the active player’s energy type. QB/WR/TE generate Pass,
RB/OL Run, DL/LB Blitz, CB/S Coverage, and K Kick. On a knockout, draw once and wait for the
replacement to set the type. Switching after the grant affects future turns. A special ability
or an attached Energy Surge or Speed Cleats doubles its player’s grant to two. Energy Surge also
gives two of the front player’s energy immediately. Speed Cleats attaches to the active player.
Upgrades follow the player through switches and enter the discard pile on replacement or knockout.
Records with `roundEnergy: 1` replay the earlier individual matching grants. Older records keep
their original rules.


## Rivals friend battles paused (November 6, 2026)

Evan: "Remove the multiplayer battles while we figure out the gameplay." `features.rivalsVersus()` returns false, which
hides every friend-battle entry point for the Rivals group: the Challenge a friend mode, the ladder's Versus switch, the
Home banner's "Solo & Versus" (now "Solo ladder"), battles-waiting notices and dots, the Daily Games case's YOUR MOVE
sticker, the Decks shelf's friend match deck, and the guide's Versus lines. `matchesOf()` returns no matches, the
challenge/accept/decline/cancel/claim handlers do nothing, and a link to a non-solo battle route shows "Friend battles
are paused". Saved friend matches (`dyb`), friend decks, trophies and Rankings are untouched; `core/dynasty-match.js` is
unchanged. Turning the switch back on restores everything as it was (note the 72-hour claim-win idle clock keeps running
while paused). Solo is unaffected. `check-start-browser.cjs`, `check-deck-shelf-browser.cjs` and the kit check assert it.

## Rivals sound effects (November 5, 2026)

Owner-only under AGENTS.md: `data.isOwner()` enables the original generated Foley/stingers in
`core/dynasty-sfx.js`. No external audio assets or game-save changes. Hub, battle and pack scene clients
share one effects context with cached buffers, six-voice limit, short repeat cooldown and output limiter.
Card actions, foil tearing, resolved coin/attack results (including misses and knockouts), rarity reveals,
and fresh match outcomes have distinct cues. Never replay events when opening a saved battle.
Effects start after a trusted gesture; hide/exit, backgrounding and profile changes cancel active/pending
sounds. Pack skip/close uses its existing animation clock and cancels stale cues. Missing audio support
must not block gameplay. Music stays separately controlled. Menu/ Battle options → Settings adds
an effects toggle and volume slider, saved only in `gg-rivals-sfx:m_evan:v1`.
Verify `node tools/dynasty/check-sfx.cjs`, `check-music.cjs`, `check-music-cache.cjs --browser`,
`check-table.cjs`, `check-reveal.cjs`, `check-start-browser.cjs`, rules, decks and scope checks.
The music-only regression explicitly mutes effects to isolate the music context lifecycle.

## Rivals music (November 5, 2026)

Owner-only under AGENTS.md: `data.isOwner()` enables Evan's uploaded Sundress MP3 by A$AP Rocky
(`audio/rivals/sundress-v1.mp3`, original file, November 5). It replaces the synthesized Fourth Quarter theme.
`core/dynasty-music.js` owns one looping media element with Web Audio volume for the hub and battle views; it starts only after
a gesture, pauses when the view or document is hidden, and stops immediately on profile changes. Menu → Settings
and Battle options → Settings include a named jukebox, play/pause/restart, music-level and song-position sliders.
The bottom-right speaker in the hub and battle uses the same saved on/off preference; its icon and accessible
label stay in sync with Settings. Muting on the title screen does not start playback or dismiss the title.
Hold the speaker for 300 ms to reveal the volume bar above it. Drag right/up to raise volume or left/down
to lower it; release/cancel hides the bar and keeps the speaker. A hold never also toggles mute. Arrow keys
adjust by five percent while focused. Route/profile changes and backgrounding cancel the gesture.
The chevron beside the speaker opens a bottom-right song panel with title, artist and Skip. Skip advances
through `TRACKS` (restarts the current song when there is only one) and preserves mute/volume. Opening the
panel alone does not start audio. Outside tap, Escape, volume hold and route/profile changes close it.
Phone buttons remain device media volume; the music slider controls only the in-game gain. Request the optional
Audio Session `playback` type and publish Media Session song metadata, play/pause and seek controls; restore the
prior session type and remove native handlers on hide, exit or profile change. Unsupported system APIs must not
break playback. `TRACKS` holds uploaded tracks; saved on/off, level and selected track use `gg-rivals-music:m_evan:v1`, separate from
game progress. The track downloads only when played and caches on demand, with proper byte-range responses
for offline playback. Other profiles keep their existing silent game and menus and never request the MP3.
Verify `node tools/dynasty/check-music.cjs`, `node tools/dynasty/check-music-cache.cjs --browser`, the title-screen browser
check and the stylesheet scope check.

Jukebox and battle music (November 5, 2026, Evan sent YouTube links: "insert songs into rivals game", "add these songs
after", and for the first of his list "use this one for music while in battles, music should start at random times in the
song", then a second list: "import these songs as well"). `TRACKS` holds 39 songs in his lists' order after Sundress (Nov 9 2026: eight more, "insert songs into rivals": Hunger on Hillside,
Lifestyle, The Basement, Forget It, Gorgeous, Banking On Me, Survival of the Fittest, No Option; his Ballin' link was already in)
(`audio/rivals/<id>-v1.mp3`, 160 kbps MP3 made with yt-dlp);
the menus loop the picked song, the song panel's Skip moves to the next one, and the Settings list scrolls (opening at the
playing song). Battles (`attachMusic(el, visible, 'battle')` → `attach(..., 'battle')`) play the battle playlist (below);
there Skip moves to the next battle song. Each new battle view starts it at a random spot (a random song, part and moment);
returning to the same battle carries on. In a battle the Settings jukebox heads with "Battle playlist"; a song picked there plays for
the rest of that battle (and becomes the menu song), and a song the playlist interrupted resumes where it was. A new source's
start is set before its metadata loads (`jump()`), so it never plays from 0 first. To add a song: put
`<id>-v1.mp3` in audio/rivals and a `song()` line in `TRACKS`; changed audio gets a new version number.
`check-music.cjs` covers the 39-song jukebox, the random start, part chaining and the battle jukebox.

Battle playlist (November 7, 2026, Evan sent six YouTube links: "Use the attached for in game music when playing rivals";
the Rivals group). Battles play `BATTLE_SONGS` in `core/dynasty-music.js` instead of the retired Cyber Funkwave mix (its
files are removed): GTA V's pause menu, Sonic's Green Hill Zone, Call of Duty: Black Ops' multiplayer menu, Call of Duty 4's
main menu theme, Fortnite's OG main menu and ESPN's NFL Primetime music. The menus keep the jukebox. The looped
uploads were cut to whole passes (Green Hill and Fortnite three 77 s loops, Black Ops two 109 s loops, CoD4 one 134 s pass);
GTA V's 21-minute suite is cut at quiet moments into four parts (`gta-menu-v1-01…04.mp3`) and ESPN's video into its 16 tracks
(`espn-primetime-v1-01…16.mp3`), so a phone fetches only the part that plays. Every file was loudness-normalised to -16 LUFS
when encoded (ffmpeg loudnorm, 128 kbps; the originals ran -13 to -33 LUFS), so battle songs play at level 1. The six songs
shuffle with the never-twice rule (`playThrough('parts', 6)`); a song with parts plays one part a turn (the battle's first
turn of each starts at a random part, then they follow on), and the player names it ("ESPN · 3 of 16"). Seeking stays inside
the playing file. To add a battle song: its file(s) in audio/rivals and a `battleSong()` line with each part's length.
`check-music.cjs` covers the files, the random start, the battle shuffle, part naming and the battle jukebox.

Levels (November 5, 2026, Evan: "Reduce the volume of the background music. The sound effects should be more noticeable.
Do not deafen the music when a sound effect is used"). Effects never lower the music (no ducking). Each track's `song()`
line carries its measured loudness (integrated LUFS, `ffmpeg -af ebur128`); `level` brings it down to -16 LUFS and
`MUSIC_LEVEL` (.7) lowers all music, so the music gain is slider × .7 × level (loud hip-hop masters about -11 dB, the mix,
-14.2 LUFS over its pass, about -5 dB). Effects' gain is slider × `EFFECTS_LEVEL` (2, was .65: about +10 dB) into their
limiter; the quiet tap (`select`) tone is louder too. Saved sliders and defaults (music 8, effects 55) are unchanged. A new
song needs its LUFS in its `song()` line. `check-sfx.cjs` asserts the music holds steady under overlapping effects and the
effects gain; `check-music.cjs` the battle mix's gain.

Shuffle (November 6, 2026, Evan: "Shuffle the music in rivals. The music should never follow the same play through twice";
the Rivals group). The menus no longer loop one song: they play the jukebox in a shuffled pass, each song's end (or Skip)
moving to the next, then a fresh pass. The battle mix starts at its random spot, then plays its other six parts in a
shuffled order (Skip and part ends follow it); seeking into another part starts a new pass from it. `playThrough()` in
`core/dynasty-music.js` deals each pass: never an order in the profile's recent history (`gg-rivals-shuffle:<profileKey>:v1`,
the last 64 orders of each list, written only for Rivals profiles; separate from music settings and saves), never opening
with what just played, with a fallback that turns the order round if `Math.random` repeats itself. Entering Rivals or
switching profile deals a new jukebox pass that does not open with the saved (last played) song; picking a song starts a
new pass from it; another tab's storage event syncs only on/off and level. The saved `track` is the song playing.
A decode error in a track's last two seconds counts as its end (`sundress-v1.mp3` has a damaged last frame that Chromium's
Symphonia MP3 decoder rejects), so the shuffle carries on. `check-music.cjs` asserts whole passes, new orders (also with a
stubbed `Math.random`), song-end and part-end advance, battle Skip and that other profiles save no shuffle.

## Rivals deck shelf (November 5, 2026)

The owner shelf now includes 16 additional recipes: eight position groups and eight attribute themes (Gunslinger
QBs, Dual Threat QBs, Bell Cow RBs, Deep Threats, Route Technicians, YAC Specialists, Lockdown Defenders and Sack
Attack). `core/dynasty.js` `deckThemes()` exposes them only through `tableOpen()` / `data.isOwner()`.
`themedDeck()` filters by position and the card's named attributes, ranks matching cards by those attributes,
and uses only owned cards plus the reusable playbook. Dual Threat limits legacy legends to selected mobile QBs
because their old attributes were derived from overall rating. Every new recipe needs 40 total cards, at least
12 matching player cards and six different players; it never fills gaps with off-theme players. Browsing does
not mutate a save. The detail sheet shows the qualifying ratings and missing-card counts. Saving/selecting uses
the existing deck slots. Attribute/position themes introduce no new battle bonuses; NFL team chemistry stays
unchanged. The deck-shelf checks cover all 48 recipes, trait thresholds, sparse/single-copy collections, save,
select, reload, solo matches, phone layouts and owner/profile boundaries.

Owner-only under the current AGENTS.md rule (`data.isOwner()`): Decks shows a Build New slot and up to 30 saved
40-card solo decks, followed by NFL team recipes. The original solo deck is retained; reading the shelf never
changes a save. The first explicit save stores `table.decks [{id, name, ids}]` and `table.active`, with `table.deck`
kept in sync for compatibility. Drafts can be saved but cannot be selected for battle. Existing friend decks,
collections, balances, table finishes and in-progress matches remain intact. Quick-sell protects the maximum copies
used in any saved deck. Non-owner profiles keep their existing deck screen and rules.

A deck with at least 12 player cards, at least 6 distinct players, and every player from one team qualifies for
chemistry. New owner solo matches snapshot `chemistry: {v: 1, team}` into the existing match record. Starting with
that side's second turn, a successful attack adds 5 damage only while a different teammate is benched. This bonus
does not stack, grant energy, or rescue a failed All or Nothing attack. Preview and resolution share the calculation.
Old matches and friend matches omit the option and replay unchanged; the base table rules remain v6.

Implementation: `views/dynasty-decks.js`, `css/views/dynasty-decks.css`, `core/dynasty-table.js` and the existing
Dynasty save/battle/solo modules. Verify `check-deck-shelf.cjs`, `check-deck-shelf-browser.cjs`, `check-rivals-rules.cjs`,
`check-rivals-decks.cjs`, `check-table.cjs`, `check-start-browser.cjs` and `check-scope.cjs` in `tools/dynasty`.

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

November 7 wardrobe follow-up (every Return Man profile): Customize has Skins, Team jerseys and
Rides tabs. The seven original outfits gain stitched panels, collars, stripes and themed markings;
32 NFL home-inspired jerseys cost 200 Return Man coins each (`core/return-team-kits.js`). Existing
outfit IDs, ownership, balances and per-day receipts stay in the same v1 local profile save.
The optional `number` field defaults to `22` on old saves. `setNumber()` saves a free choice of
0–99 or `00`; `kitFor()` passes it to previews, the 3D runner and canvas fallback. Invalid input or
storage failure never changes the saved number or spends coins. Profile switches close the shop.
Player previews use inline SVG with intrinsic dimensions and painted shadows, without SVG CSS
filters inside the scrolling dialog. `return-jersey-art.js` shares the gameplay uniform prints;
number changes repaint textures without creating new model variants. Keep cache growth bounded.
Verify Customize wallet/integration checks, visible artwork at phone widths, jersey purchase and
number reload/profile boundaries, plus the existing Return Man motion/intro/performance checks.

November 7 difficulty follow-up (everyone): the opening football field has training benches, hurdles, slide bars
and divots, with no team buses or train cars. Enhanced stadium vehicle picks replace `teambus` with `bench`;
incoming trains still begin only after leaving the 500-yard stadium. `speedAt(z, hard, enhanced)` applies
`ENHANCED_PACE` (1.22) to gameplay speed. Obstacle spacing uses the original pace so reaction time is shorter.
Coin jump arcs, clearance, jetpack trails and stumble timing account for the faster motion; legacy course and
reward fixtures retain their earlier pace. Scores, saves, daily attempts and coin prices are not reset.

November 7, 2026 scenery, Customize and rides (shared with every Return Man player):
`return-neighborhoods.js` adds deterministic, batched roadside scenes in all nine places, with matching canvas
fallbacks and a clear run corridor. The desert has continuous western storefronts, saloon signs, cacti, mining
props and layered canyon cliffs. Keep the 500-yard zone length, existing model fallbacks and scene budgets.

Customize opens from the title and finished-day cards. `core/return-customize.js` owns seven skin palettes and
two free rides, with purchases and equipment saved under `gg-return-customize:<stable profile key>:v1`.
The unselected visitor has a separate device-local slot. Daily-run pickups credit a cumulative per-day receipt
once; practice never earns currency. Profile changes invalidate the active wallet receipt and close Customize.
These coins do not spend Keepfall Gold, import old device-wide score history, change daily attempts or reset saves.
The screen says its wallet is saved on this device. Failed storage writes must not grant or charge purchases.

Double tap, the ride button or R summons the equipped scooter/hoverboard: 12 seconds, one absorbed collision,
then a 20-second recharge. Rides preserve jump/slide/roof behavior and give no scoring multiplier. Jetpacks stow
them; all ride timers pause with simulation. `return-rides.js` owns 3D/canvas props; `return-3d.js` caches skin
models and warms ride shaders before Play. Verify `check-neighborhoods.cjs`, `check-customize.cjs`,
`check-customize-integration.cjs` and `check-rides.cjs`, plus the existing Return Man checks below.
The bottom-right ride indicator is a compact 44px icon-only button: teal when available, gold while riding,
muted while unavailable, with a tiny recharge/duration bar. Keep its status in the accessible label, without visible text.

November 5, 2026 shared rollout (Evan: "Make all the new return man changes available to all players"):
the complete November 4–5 pilot is now available to members, app users, named guests and unselected players.
`core/features.js` `returnManUpdated()` controls Return Man alone, independently of owner privileges and other
app pilots. The view passes it to the optional fifth `startRun` argument; legacy course fixtures remain separate.
Do not restore profile gates to this shared experience. Existing saves, daily limits and reward eligibility remain.

Everyone gets the longer, bouncier stride, incoming trains and eight-second jetpack. Incoming trains start only
after leaving the opening football field (November 5 follow-up); the stadium keeps its regular obstacles.
Flight is belly down, headfirst, with barrel rolls for lane changes. Each pickup creates a fresh sky course and coin trails; birds,
balloons, drones and debris leave an open route. A sky hit triggers descent; painkillers protect. Moving bus/train
roofs are solid landing and running surfaces (`surfaceAt`). Keepfall's first-run reward eligibility and daily caps
remain. All active boosts give 2x yards, never stacking above 2x; salts' extra lives last only during their boost.
A first stumble starts a four-second pursuit, followed by a visible retreat. A new unprotected hit while the
chaser is still visible ends the run; only his leaving the screen clears the pursuit. Painkillers, stored salts,
flight clearance, roof landings and duplicate-contact handling keep their protection. The chaser uses the
runner's run clip, stride rate, bounce and lean.

November 5 rollout completion (Evan: "Make sure all changes for return man are active for all user accounts"):
the salts follow-up now applies to everyone. Unused salts expire when their speed boost ends and disappear from
the HUD. Protection during the active boost stays intact. Gameplay and help text have no remaining owner-only
rules. `check-motion.cjs` covers every registered member and app user, guests and unselected players, including
expiry, repeat pickups, active/expired collisions, HUD removal and pause/resume.

The stadium-tunnel title waits for Play, including Practice. `return-intro.js` times the 2.6-second punt,
two-handed catch and camera orbit into the chase camera. Simulation and scoring freeze until handoff.
Pause/resume preserves the shot; reduced motion uses a shorter catch with a fixed camera. Canvas fallback remains.
`D3.prepare` preloads player, pickup and jetpack shaders under the title. Callouts use transform/opacity without
layout flushes; the HUD and beer effect avoid full-scene blur. `check-performance.cjs` verifies no new shader
compilation or forced layout reads during pickups/stumbles; software-GPU timings are diagnostic.
No obstacle hint arrows or train/flight instruction banners appear during gameplay. November 8, 2026: all power-up
pickups (painkillers, beer, salts and jetpack) have no text popup for any Return Man player. Boost effects, HUD,
haptics, start-screen help and screen-reader announcements remain.

Every scenery lasts 500 physical yards (`zoneLength`), including the opening stadium, which never
recurs. Touchdowns remain every 100 physical yards; render tiles and markings stay at 100 for bounded batch sizes.
Gates, sky/light blends, model preloading, zone events and vehicle boundary clearance use the scenery length.
All nine places use the colorful low-poly art, batched living details, contact/sun shadows, shader wind and ambient
motion. `return-style.js` owns palettes, `return-scenery.js` roadside detail, and `return-life.js` living motion;
its clock pauses with play and freezes for reduced motion. `return-air-world.js` owns sky hazards/fallback flight.
Preserve City bus art, its loading-failure fallback, and shared assets across profile changes.

Before publishing, run `node tools/return/check-motion.cjs`, `check-intro.cjs`, `check-performance.cjs`,
`check-environments.cjs`, `check-city-bus.cjs` and `check-city-cache.cjs` in tools/return. Motion checks shared
courses across profiles, no stadium trains, and movement against the deployed owner pilot (c90656a); environment
checks compare all nine shared scenes with that art, including guests, account transitions, reduced motion and canvas fallback.
Intro checks exercise actual Play, preloading, camera/catch and text-free pickups across profiles.

November 5 replay reset (everyone, explicitly requested): November 5 is Return Man day 17. `RETURN_REPLAY` in
`score-release.js` redirects only that day's cloud result from `scoresV3.rm2.17` to `scoresV3.rm2.17r1` and projects
it back to day 17 for all board/reward consumers. Old clients can only write the retired slot, so stale scores cannot
return or overwrite a replacement score. `return.js` migrates `gg-v3-ret1` to `gg-v3-ret2` once, retaining every
other day and removing day 17's results/live attempt; the original store remains archived. One new counted attempt
is allowed, with the normal cross-device lock afterward. Other games, identities and resource saves stay intact.
The original Toreadors midfield artwork is restored for everyone in 3D and canvas. The stadium still never recurs.
`node tools/return/check-reset.cjs` checks all-profile migration, posting, old-client writes and cross-device limits;
the environment check verifies the logo and its shared loading across profile changes.

The player (November 4, 2026, Evan: a cartoony runner, Subway Surfers' style; shipped to everyone):
`models/return-runner-v1.glb`, from KayKit's Adventurers (Kay Lousberg, CC0): the Barbarian's body for both players, the
Knight's head on the returner and the Barbarian's on the linebacker, made into one by `tools/return/runner-model.mjs`
(bones renamed to Mixamo's, with a Spine1 and a Neck put in; the kit's faces moved to swatches the view repaints). His
clips come from Evan's Endless Runner pack via `tools/return/runner-anims.mjs`. `views/return-3d.js` dresses each side:
kit colours, helmet, shoulder pads, numbers, the ball in his right glove. A changed model gets a new version number.
The kit check "the cartoon runner…" (`js/core/checks-return.js`) covers the model.

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
  "Ryan S", Ryan Younggreen "Ryan Y" (Nov 5 2026), anyone added later) and every guest (tagged Guest). Pick'em standings and Keepfall's Visit list too.
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
  Daily Games case and links are on his phones only, it raids the computer's realms (and other players', below), and no one else's scores,
  names or realms appear in it. Exception (Oct 23 2026, the owner: "Users should be able to view other players bases"):
  Visit (`js/views/realm-visit.js`, `core/realm.js` `visitable()`) lets anyone look round other players' realms, read-only
  (raiding them is Attack's, below), by the scoreboard rule above (since Oct 24 2026: everyone's realm to everyone). The kit check
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
  screen when entering the dynasty", `views/dynasty.js` `startHTML`, the logo, Tap to Start (no drifting cards since Nov 2 2026, Evan: "Remove the cards from the start screen"), with the
  five tabs at the foot incl. the Menu (≡), the header's pack and coin counters, the Packs stage and the Battle banner
  after his Pocket screenshots; verify `node tools/dynasty/check-start-browser.cjs` before Dynasty visual releases (and `node tools/dynasty/check-scope.cjs`: its
  stylesheets share the pk- prefix with the Pick'em and must stay scoped to the Dynasty's roots);
  a pack's cards revealed by rarity, Oct 29 2026: "The more rare the player, the more exciting the animation",
  `views/dynasty-open.js` `REVEAL`/`revealOf`, ◆ dealt to ♛ with the crown, rays, flash, sparks and confetti, verify
  `node tools/dynasty/check-reveal.cjs`):
  Evan's, Ryan Stewart's and Jayton's (Jayton added November 5, 2026 by the owner).
  `js/core/features.js` `DYNASTY` / `dynastyOpen()` / `dynastyKey()` hold it, by
  the member ids (`evan`, `jayton`) and Ryan Stewart's app-user id (`ryan-stewart`), never a typed name: the Daily Games case (`games.js`
  ONLY), the routes, `mayPlay()` (saving), who can be challenged and the board all go by them. Don't open it to anyone
  else unless he says so.
  Each profile's save rides on its board doc as `dy1[profileKey]`, its side of each battle as `dyb[profileKey][matchId]`;
  its Dynasty board, who can be challenged and the other side of a battle read `daily.LB.raw` (`others()`, `list()`),
  never `LB.all` (that only finds your own saved copies, as Keepfall does). Its coins come from the Daily Games' results
  on your board docs (`earnedOf`). The kit checks "Gridiron Dynasty…" (`js/core/checks-dynasty.js`) cover it.

Jayton's admin and Rivals access (November 5, 2026): the owner requested Jayton become an admin and receive
Rivals access with unlimited coins. `core/lay.js` `ADMINS` includes his existing member id `jayton`, allowing
him to enter, edit or remove any member's leg even after closing. `features.coinsUnlimited('m_jayton')`
gives his Rivals wallet unlimited spending; Infinity is computed for display, never saved, and purchases leave
his existing credits/spending intact. Evan and Ryan Stewart keep their existing unlimited packs. Owner-only
tools and Rivals pilots still use `data.isOwner()`; Jayton is not an owner. Verify `node tools/dynasty/check-access.cjs`.

## Keepfall asset refresh: preserve current progress

Keepfall daily attack limit (November 5, 2026; owner-profile pilot per AGENTS.md):
`core/realm.js` `dailyAttackLimited()` uses `data.isOwner()`. One attack total per local calendar day,
across computer and player realms. The first valid troop or hero deployment spends the attempt;
scouting and leaving before deployment are free. Quitting, losing or reloading after deployment counts.
Existing `bt` raid-day entries persist immediately and merge across saved copies of the same profile;
no new save schema or progress reset. A battle crossing midnight counts on the day it started.
Other profiles retain their existing attack behavior. Run `node tools/realm/check-daily-attacks.cjs`
and `node tools/realm/check-pvp.cjs` for the limit, persistence, profile boundaries and raid flow.

Evan approved upgrading the existing Keepfall in phases using the Unity assets
in D:\Unity\My project\Assets. Preserve every player's current progress.
Art imports must keep existing building IDs, footprints, levels, balances,
training queues/timers, armies, heroes, hatchery species/colors, trophies and
raid history. Keep the current gg-v3-fr1 profile keys, fr3 remote records and
gridiron-hub-v3 reset marker. A graphics release must never start a new season
or reset a realm. Any later schema change needs a versioned, repeatable migration
with a preserved original save and tests for members, app users and guests.

No computer raids (Nov 1 2026, Evan: "Remove cpu raids in Keepfall game mode"): the computer's realms never raid a
player's realm. `core/realm-battle.js` `defend()` plays nothing and the screen never calls it (no "While you were away");
players still attack the computer's realms, the example raids stay (nothing taken), and raids already on a realm's record
(df) stay in the Chronicle with their replays. `playRaids` is the old engine, for the checks alone. The kit check
"Keepfall: no computer raids…" covers it.

Player raids (Nov 5 2026, Evan: "Players should have the option to attack other player's bases in Keepfall, not just cpu
bases"; he chose everyone): Attack lists "Players' realms" above the computer's (`core/realm.js` `playerTargets`, by the
scoreboard rule via `visitable`); Scout and Attack take `p:<profile key>` (`isPvp`, `playerRealm`). A phone writes only its
own board doc, so a raid is posted, not delivered: the raider's `rd` record (vs `p:<key>`, `ls`/`lb` what it took from
storage and from each mine/brewery pile, `by`/`bw` house and name, its replay) rides on the raider's save
(`finishPlayerRaid`); the raided realm takes it off itself on its next sync (`takeIncoming` -> `takeRaid`, into `df`, with
a toast and the Chronicle's Watch), each once (`pw[raider]`, the newest taken), a forged take capped at `LOOT_CAP`. A raider
sees posted raids already taken off. Both Castles at 3+, theirs at most a level above yours and `PVP_BELOW` (2) below,
one raid a day each (`bt`), a `PVP_TRUCE_H` (12h) truce after a lost star; loot is `lootOf`'s, the coffers never raided.
The computer's realms still never raid anyone. The kit check "Keepfall: raiding other players…" covers it; verify
`node tools/realm/check-pvp.cjs` (Attack list, Scout, a raid, the defender's take, toast and Chronicle in a real browser).

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
Rarity finishes follow the owner's card references: type-tinted silver Common, violet/cyan Epic,
illuminated gold Legendary, and prismatic cosmic Mythic (Rare retired Nov 2 2026). Keep the name/HP header and framed artwork readable.
`dynasty-rarity.css` and `img/rivals/` own the materials; `dynasty-foil.js` adds reflections in details and reveals.
Collection previews stay still, with reduced-motion support. Verify `check-card-layout.cjs`.
Mythic foil (Nov 1 2026, Evan, with a holographic foil picture: "Use the attached for a background picture for the special
cards, the highest rarity only"): Mythic cards alone wear `img/rivals/mythic-holo-v1.webp` behind the player in place of the
tinted plasma (team mark, nickname and streaks stay on top) and as the card face behind the frame (`dynasty-rarity.css`).
Battle pieces keep their light faces.
Epic purple (Nov 2 2026, Evan, with a purple brushwork picture: "Use the purple background for cards with an epic rarity in
rivals"): Epic cards wear `img/rivals/epic-purple-v1.webp` the same way, behind the player in place of the tinted plasma and
as the card face behind the frame, rules on opaque lilac panels (`dynasty-rarity.css`).
Legendary gold (Nov 2 2026, Evan, with a gold-leaf picture: "Use the gold for legendary"): Legendary cards wear
`img/rivals/legendary-gold-v1.webp` the same way, name and rules on ivory panels.
One card a player (Nov 2 2026, Evan: "There should be no two cards for the same player. A player needs to fall into one of the
following categories: common (79 overall or less. Use the current card design), epic (80-89), legendary (90-95), mythic (96+)";
he chose each player's best card): `core/dynasty.js` `setData` keeps each player's highest-OVR card in `CARDS`, the rest go in
`ALIAS` (old id -> kept id) but stay in `BY_ID` so old battles replay; `rarityOf(ovr)` alone sets the rarity (`SCALE`), Rare is
retired, and the mark (so the reveal) is the rarity's (◆ / ◆◆◆ / ◆◆◆◆ / ★, ♛ Legends). `fold()` (run by `clean()` and `mine()`,
repeatable) turns a save's retired copies into copies of the kept card (collection, deck, new marks, latest pulls; the deck is
rebuilt only if that makes it illegal); this phone keeps the save as it was once in `gg-dy1-<key>-premerge`. Packs' 'live' pool is
every active player (any series but Legends). Battles: rules v5 (`B.RULES_VERSION`) make every player card a Basic (`stageOf`,
`basicIn(id, v)`; nothing evolves); v1-v4 matches keep their Gameday/Prime upgrades. The kit check "Gridiron Rivals: one card a
player keeps every save whole…" covers the fold.
Frames by rarity (Nov 2 2026, Evan: "the common player cards should be bland with no effects, and the legendary should be glowing
with gradients and sparkles"): `dynasty-rarity.css` (end): Common flat matte; Epic a violet glow and three sparkles; Legendary a gold
halo, a conic gold ring and six sparkles; Mythic a rainbow ring (`--ring-a`), a prismatic halo and eight sparkles. They move only
up close or on the reveal, never in the binder or with reduced motion.
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
fans the whole hand along the foot (sized by screen height so felt, hand and bar fit a phone). Tapping any card opens
its details sheet (Nov 5 2026, Evan: "Clicking a card in the rivals gameplay should bring up a detailed screen similar to
[Card details]. Remove the other screen entirely containing the start with him and put back options"; everyone):
`focusSheetHTML`/`syncFocus` in `views/dynasty-battle.js`, the white `pk-sheet db-focus`: the collectible card, its
HP/energy on the table, then what it can do now (your active player's plays as buttons with cost, damage and what's still
missing, Send in / Switch out, a hand card's play, setup's lineup choices; a lineup is suggested), then its battle side
(`battleHTML`). No lifted-card overlay, no Put back: closing the sheet (X, swipe, Back) sets the card down; a move closes
it; it refreshes in place as the match changes. Hand
indexes stay the cards' identity, so duplicates stay apart.
Card preview (Nov 6 2026, Evan, with a Pokémon TCG Pocket screenshot: "When a card is selected in game, this should be the
preview screen for the player to decide whether to use one of their attacks, retreat and switch with another card, or do
nothing (click outside of the card which sets it back down)"; the Rivals group): the white details sheet became
`previewHTML`, a transparent full-height `pk-sheet db-focus db-preview` over a dimmed table: the card enlarged, an HP/energy
tab above it, your active player's plays as glowing banners covering its printed attacks (cost, name, damage, effect or what's
missing; disabled ones grey), a Retreat bar with its cost (one bench player: switches; more: choose), a bench player's Send in,
a hand card's play, setup's lineup choices. A tap anywhere outside the card and its buttons, Escape, a swipe or Back sets it
down; Details opens the old card sheet (`detail`, `battleHTML`) over it. `check-rivals-battle.cjs` covers it. New matches (solo and friend) use rules v4
(`B.RULES_VERSION`): the turn's energy attaches itself as the turn starts (`autoEnergy`: the active player while it
helps his signature play, else the bench player it brings nearest his; after a knockout, the one sent in). A v1-v3
match keeps attaching by hand (Give energy on the lifted card).
Deck piles (Nov 6 2026, Evan, with a Pokémon TCG Pocket screenshot: "place the rest of the players deck face down on the
table"; the Rivals group via `tableOpen()`): `views/dynasty-battle.js` `deckPileHTML` lays each side's remaining deck on the
felt as a stack of the printed back (`card-back-v1.webp`), yours right of your active player, theirs left of theirs, its edges
thinning as it runs down and its count on a chip. Yours opens the deck sheet (contents, never the order) and replaces the old
"in deck" button; theirs is a count only. Display only: no rules or save changes. `check-table.cjs` covers counts and the sheet.
Solo is a 30-game ladder against the computer (Oct 30 2026, the owner: "focused on games against the cpu getting
increasingly difficult. The beginning stage should be very easily ... around 15-20 games in there is a noticeable
difference, where strategy must be applied to win"): `core/dynasty-solo.js` `STAGES` g1-g30 in six tiers, each won
game unlocking the next (progress is the save's Solo wins, `s.so.g<n>`). Early decks are low-rated and weak to your
deck's main type and the computer slips; from game 16 (Pro) decks counter your main type and the computer plays
Trainers, switches and hunts knockouts (`skillOf`); Legends from 22. A win pays `D.ladderPay(n)` (double the first
time, packs every fifth game). Keep the twelve earlier opponents readable so an old battle still finishes.
Resolved play events drive the skippable stadium scenes; animations never submit moves or resolve damage.
Queue opponent scenes while a details sheet is open; clear presentation on profile changes or leaving the battle.
The shared card reverse is the owner's printed back (Nov 1 2026, Evan: "Use the attached for the back of the cards"):
navy frame, blue/teal shards, the football, mirrored GRIDIRON RIVALS wordmarks (`img/rivals/card-back-v1.webp`, built from
`tools/dynasty/src/card-back-source.png` by `tools/dynasty/card_back.py`; a changed back gets a new version).
The case's booklet matches the pastel start screen, floating cards and yellow/blue logo (`dynasty-book-v4`);
the disc matches the cover (Oct 31 2026, Evan: "Change the disc to match the design of the front"): the cover's
holographic foil rim and gold bevel, its royal-blue rayed face, its gold logo and glowing football, Trading Card Game
round the foot, the clear hole unchanged (`dynasty-disc-v4`, built from the cover by `tools/dynasty/disc_v4.py`).
Foil packs (Oct 31 2026, Evan, with mock-ups of the case's cover as foil packs: "Make 3 standard packs, the ones that cost
more will have a brighter, more detailed design"): the Standard, Team and Premium Packs (`views/dynasty-packs.js` FOIL) wear a
crinkled holographic wrapper round a framed card window, the cover's logo at its head, a swirl of light round the cover's
football (`views/dynasty-art-foil.js` helpers; designs in `dynasty-art-std/team/prem.js`, viewBox 0 0 86 114). Brighter and
richer by price: Standard calm silver foil and a dark frame; Team brighter foil, gold frame, rings and rays; Premium rainbow
foil that shifts, neon frame and glow, stacked cards, sparkles. `tools/dynasty/pack_art.py` builds `img/rivals/packs/`
(foil, ball, logo-<kind>) from the cover. Gameday, Legends and the Starter Pack keep their designs. Prices and odds unchanged.
Copies stack in the binder (Nov 2 2026, Evan: "If a user has more than one player card, should stack in the cards screen
with a number in the corner showing how many total"): `views/dynasty.js` `stackHTML`, the printed back peeking out behind
(one layer for two copies, two for more) and a ×N badge at the top-left (`dynasty-rivals-hub.css` `.pk-stack`, which keeps
content-visibility so the binder stays fast). Collections pay more packs (same day: "Completing collections rewards the user
with more packs"): `core/dynasty.js` `BONUS` joins every set's reward; a set claimed earlier got its bonus once (`kit4`, `topUp`).
Three packs on sale (Nov 2 2026, Evan: "There should only be 3 available packs. The standard daily packs that can be purchased
for coins and one free pack a day. A team pack that allows a specific team but is less items. And an epic pack that can be
earned through solo games, rewards, and a premium coin cost. A pack should never have the same item twice"): `PACK_ORDER` is
std, team, prem. Standard (1,000 coins, the daily free pack) 5 cards; Team (1,200) 3 cards of the team picked; the Epic Pack
(id `prem`, 5,000) every card Epic or better, also from Solo ladder milestones and collection rewards. Gameday and Legends
are `retired`: never sold or opened, and `clean()`/`addPacks` turn one held into Epic Packs (`RETIRED`). `drawPack` never repeats
a card or a player in one pack. The kit check "three packs on sale…" covers it.
Player pages (Nov 2 2026, Evan, with MLB The Show's player screens: "Remove the real cards section. Expand on the players
stats. Take inspiration from the attached mlb the show stats page"): a card up close shows no real cards; under it
`views/dynasty-stats.js` `pageHTML` draws the player's page: position, number badge and name in his team's colours, a bio grid
(rarity, series, experience, height, weight, age, college, draft), and tabs: Attributes (the card's ratings as tall bars on
0/50/99, coloured by tier, and his ranks at his position this season), Stats (this season and last, the position's full
table) and Games (his last five). Bio and tables come from `data/dynasty-stats-v1.json`, built by `tools/dynasty/stats.py` from
nflverse (rebuild it alone as the weeks go by; it never touches `data/dynasty.json`'s ratings). The kit check "a card up close
is the player's page…" covers it.
Card details retain standard 63:88 proportions; printed attacks and stats use compact spacing and smaller damage
numbers while keeping rarity frames, team scenery, portrait credits and small-card behavior intact.
Verify the existing Dynasty checks plus `check-rivals-rules.cjs`, `check-rivals-decks.cjs` and `check-rivals-battle.cjs`
(the kit check "Gridiron Rivals Solo ladder…" covers the ladder's decks, moves, unlocking and pay).
Action photos (Oct 31 2026, Evan: "Leave the headshot pictures for the common cards. For rare or higher, the photo should be
an action photo of the player with a background color to match the team", then "Where can we find live action pictures of
the players that would be used for trading cards? There should be a clean cutout of the player in game. Remove any headshot
of the legend players. All cards aside from the common 'basic' cards should have an action photo of them in their playing
days"): every Rare, Epic, Legendary and Mythic card, and every Legend's card, wears the player cut out in game, only him, on
the card's own team colours and graphic (`js/core/dynasty-action.js` ACTION, `img/dynasty/action/<key>-v3.webp` with
alpha, head `a:<key>`, class `is-action`). The photo is his own trading card's (the CardSight scans in `img/dynasty/real`:
newest base card, else his first card that is a game photo; `CARD_SKIP` leaves out painted, portrait and comic inserts,
`CARD` picks another), upscaled 4x (OpenCV EDSR) and cut out with rembg's BiRefNet portrait model plus Segment Anything so
teammates and opponents go; else a freely licensed Commons photo of him in uniform (`PICK`/`CROP`, credited with author,
licence and page, which the licences require; `COMMONS_FIRST` prefers it). Quality first (Nov 1 2026, Evan: "Ensure good
quality pictures are being used. The card scans might be too fuzzy"): the scans are only 160 x 225, so where a sharp (800+
px) Commons game photo of him alone in an NFL uniform exists it goes in `COMMONS_FIRST` (chosen by eye side by side with
the card's cut-out); the rest stay on their card's photo until larger CardSight scans arrive. Card details name the trading card a photo
comes from. Common cards keep their headshot; no Legend wears a headshot or Wikipedia lead photo (those are retired:
`dynasty-legends.js` PHOTO is no longer worn), a Legend without an action photo shows his number. Rebuild with
`tools/dynasty/action_photos.py build` (about 45 s a player on the CPU; `crops` for Commons framing), check the cut-outs
by eye, and give changed output a new `VERSION` (sw.js keeps pictures across releases). Sharper cut-outs need larger scans
from the owner's CardSight downloader. Cleaner cut-outs (Nov 1 2026, Evan: "There are some where the cropped image looks
weird or has other players in it"): Commons' `(cropped)` files are infobox crops, so prefer the whole original or a deeper
search of the photographers' game series (All-Pro Reels, Erik Drost); never a Legend's retired lead photo. A redone player gets
his own version in `REDO` (only he is rebuilt); `ALONE` skips Segment Anything where he is the only figure; `SAM_HINT` (box,
points on him and on the other, areas to clear) separates an overlapping teammate; `YEAR` fixes a photo's year; `CLEAR`
outlines what a card scan leaves on a cut-out (frame, lettering, another player) and a card's own band; `INK` paints an
autograph out by its ink's hue (Gale Sayers). `tools/dynasty/action_sweep.py` is the deeper search: `plan`/`names`/`sheets`
go through the game and camp categories of each player's teams' seasons (All-Pro Reels shoots every Washington game, Erik
Drost the Browns), the named photos first, then every game's thumbnails on numbered sheets to scan by jersey number; `view`
draws the tenths grid CROP and SAM_HINT fractions are read off; `flickr` lists each player's freely licensed Flickr photos
(`FLICKR_API_KEY` in the environment; `PICK` takes `flickr:<photo id>`, credited with the owner, licence and photo page).
Run the sweep on the owner's PC: a cloud session's shared address gets "retry in 10 minutes" from Commons' picture host
(upload.wikimedia.org) after a few dozen thumbnails, and Flickr's hosts are outside its network policy. Never run two
Commons fetchers at once there. The kit checks "Gridiron Rivals: no Legend wears a headshot…" and "Gridiron Rivals:
action photos…" cover it.

## Press Room questions (November 5, 2026)

Evan asked: "Add a section in the press room for me to manually add questions in and tie them to the manager that
asked." Under the featured week's "Questions from the press" (`js/views/press.js` `qsHTML`), Evan's phone
(`press.canAddQuestions()` = `data.isOwner()`) always shows the section with Add a question; the sheet (`openQuestion`)
picks the week, who asked (any member) and the question (plus an optional note). His own questions open that sheet
again to change or delete. Everyone sees them after the week's seeded questions (`press.questionsFor`); no one else can
add or change them. They ride on his board doc as `prq` (`{at, w: {weekKey: [{id, by, q, note?}]}}`, `core/press.js`
`saveQuestion`/`removeQuestion`, the freshest copy among his docs by `boardKey`: `addedOnBoard`), so no Firestore rules
change; dev hosts keep them in localStorage. The kit check "Press Room: questions added in the app…" covers it; verify
`node tools/press/check-questions.cjs`.

## Live league scores (October 30, 2026)

The owner asked for live scores in the app; everyone gets them. They live on the Scores tab (Oct 30 2026, the owner: "The
live league matchups should go in the scores tab and can be toggled between with the nfl matchups in the same fashion as
the pick em screen"): under its title, Pick'em's scoreboard buttons switch NFL and League (`js/views/live.js`, the
choice remembered as `gg-live-mode`); League (`js/views/live-league.js`) is this week's matchups, each side's live score
once its players kick off, and a game's sheet both lineups slot by slot. The top performers sit on League under the matchups (Nov 1 2026, the owner: "Move the top performers to the league
section of the scores tab"); NFL keeps the games and waiver wire, ESPN's feed runs on both, and a game box opens League's top
performers for that game. Matchup no longer lists "This week's games" (Oct 30
2026, the owner: "Remove this from the matchups tab"). `js/core/fantasy-live.js`
scores Yahoo's starters (`seasons[].rosters` slots, with `week`; BN/IR sit) from ESPN's box scores (`core/gameday.js`
`parseBox`, which also reads kickers, defenses and two-point conversions) in Yahoo's standard scoring. It is unofficial:
Yahoo's final (the sync) replaces it. Each side's projected total sits under its score (Oct 30 2026, the owner: "Add total
point projections"): Yahoo gives only the team's projection (schedule `pa`/`pb`, not moved by results), so
`fantasy-live.js` shares it among the starters (position and `data/nfl-players.json` relevance, `gameday.rankOf`) and
counts points scored plus each share for the time left in his game; before kickoff it is Yahoo's number. The shares go by
each player's own projection (Oct 31 2026, the owner: "The predictions in the app don't match the yahoo app. Update this more
often"): Yahoo's API has no player projections, so the sync stores Sleeper's (`seasons[].proj`, scaled to Yahoo's total in
`fantasy-live.js`), the sync runs hourly and every 15 minutes in game windows, the League screen refetches the league file
every 3 minutes, and Yahoo's own win chance (`wa`) shows while nothing has scored since its sync (`quietSince`). Each side's chance to win sits beside its score, green for the favourite and red
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

Rivals Home pilot (November 4, 2026, current AGENTS.md scope): `data.isOwner()` enables the new Home screen
and five labeled destinations for Evan only. `views/dynasty.js` keeps other profiles' Play-first hub and four tabs;
`css/views/dynasty-home.css` scopes its chrome to `.rh-home-enabled` and its home layout to `.is-home`.
The angled football banner leads to Battle, with Packs, Collection, My decks and How to play below; saved matches
and collection rewards use existing state and actions. No collection, balance, deck or battle schema changes.
The generated artwork is `img/rivals/home-battle-v1.webp`; its prompt is in `tools/dynasty/home-art.txt`.
`check-start-browser.cjs` covers phone/tablet sizes, reduced motion, keyboard access, navigation without save changes,
live profile switching and the existing game flows; `check-scope.cjs` includes the new stylesheet.

- Standing owner instruction (October 21, 2026): after completing and verifying requested changes,
  automatically commit and push them through the deployment process below. Evan will give feedback
  on each published update; do not wait for a separate push/deploy confirmation. Include only the
  completed task's changes, preserving unrelated work in progress. Ship to every user (the rule above).
- Work on branch `claude/17-0-game-mode`, then fast-forward `main` (the live site).
- Bump `CACHE` in `sw.js` on every deploy.


## Rivals owner table pilot (November 4, 2026)

Under the current AGENTS.md scope, `data.isOwner()` enables the hold/drag card table and cosmetics on Evan's
existing profile only. Other profiles keep the deployed presentation and v5 games. New owner solo matches
explicitly save rules v6; friend matches remain v5 and old v1-v5 records keep their exact rules and replay.
`core/dynasty-table.js` builds a separate 40-card solo deck from owned cards plus eight reusable match-playbook
Items (never added to the collection or pack pools). At least six players, at most two copies. `s.table` on the
existing save stores the deck, chosen finish and successful pack-open count; no balances or collection are reset.
Every defeated player counts once, including Legends; three KOs wins. An empty bench recruits a player from the
hand/deck, then the player chooses the promotion. A 100-turn stalemate is a draw. All or Nothing is an additional
heads-or-fail attack; the two existing attacks, automatic energy and signature costs remain.
`views/dynasty-table-touch.js` owns pointer holds, legal drops, hand scrolling and cancellation. Tap/keyboard
alternatives remain. Opponent face-up cards can be inspected; their hand and draw order remain hidden. Coin
presentation reveals already-resolved seeded results and never rerolls. Table finishes unlock from solo wins,
challenge 10, and five/twenty successful pack openings; equipment lives on the same profile save. Inspect the
Decks tab's Solo table panel or the finish button on the table. Use `node tools/dynasty/check-table.cjs` for pure
rules, offline real-touch browser interactions, full-match simulations, save round trips and profile boundaries;
keep the existing rules, decks, scope, start and reveal checks passing before deployment.

## Rivals solo boss ladder (November 5, 2026)

Current AGENTS.md scope: `data.isOwner()` / `dynasty.bossLadderOpen()` enables the card-led Solo ladder as
Evan's Battle landing screen. Ryan keeps the deployed Play hub and original Solo list/decks/rewards.
Keep `g1`–`g30`, existing wins and in-progress matches. A win unlocks the next stage; old cleared stages stay replayable.
`core/dynasty.js` `SOLO_BOSSES` selects Epic+ cards at 5, 10, 15, 20, 25 and 30. New owner boss matches save
`boss: {v: 2, card}` in their existing `gg-dys-<profile>` record. Their 40-card CPU deck contains two copies;
a stored opening seed deals the boss and its recorded setup fields that card. Rules v6 and replay stay unchanged.
November 5 follow-up: normal rows are compact numbered battles; only the six boss rows show player cards.
New boss rewards alternate: one Standard Pack at 5, one Epic Pack at 15/25, and the featured Epic-or-better player
at 10/20/30. `soloBossReward` is the shared schedule. v2 pays one prize instead of the old pack bonus plus a card;
coins and progression remain unchanged. Pending v1 boss saves retain their original card/pack rewards.
Only a winning, verified boss match earns its prize. Optional `bossRewards[stage]` receipts on the existing
Dynasty save prevent repeat grants, including after opening a pack, selling a card or aging beyond the recent-match
ledger. Existing receipts (including v1 card rewards on now-pack stages) stay claimed. Old fifth-stage matches
retain their original rewards; cleared stages without a receipt can be replayed for their new boss prize.
No automatic grants, balance resets, deck changes or progress reset during loading.
`css/views/dynasty-ladder.css` scopes the presentation; the existing card artwork is reused. Run
`node tools/dynasty/check-ladder.cjs` covers all six bosses, deck legality, real pack/card victories, v1/v2 saved
rewards, receipt round trips, unlocking, compact phone/tablet layouts, resume and profile boundaries, alongside
the existing rules/decks/scope/start/reveal/table checks.

## Rivals league preview (November 5, 2026)

Evan authorized the Gridiron Rivals case for every league member. Only Evan (`evan`), Jayton Hull
(`jayton`), Ryan Stewart (`ryan-stewart`) and Ryan Younggreen (`ryan-younggreen`) may play.
Other league members see a Coming Soon sticker and cannot open the game. Unselected profiles,
ordinary guests and other app users retain their previous shelf. `features.dynastyOpen()` and
`dynastyKey()` govern routes, saves and opponents; `gamesFor()` separately governs case visibility.
Profile changes close the case and cancel pending launches. This uses the existing local profile
selection, not verified per-person authentication. Preserve owner tools, pack/coin privileges and saves.
Verify `node --experimental-vm-modules tools/dynasty/check-preview.cjs` and the existing access checks.

## Rivals pack studio (November 7, 2026)

The four-profile `features.rivalsUpdated()` pack shelf shows four top available player cards above each pack,
ranked by OVR from the actual active pack pools (`views/dynasty-pack-preview.js`). These are possible pulls;
Team previews span teams until the existing purchase team picker. Browsing never changes odds, saves or balances.
The noninteractive preview cards move with the looping shelf; its duplicate copies stay hidden from screen readers.
Short landscape screens place the preview beside the pack. `img/rivals/pack-studio-v1.svg` supplies the original
red, silver and charcoal broadcast-studio backdrop; all styles stay inside the Rivals pack shop.
Verify `check-pack-preview.cjs`, `check-start-browser.cjs`, `check-preview.cjs`, `check-access.cjs`, `check-rollout.cjs`
and `check-scope.cjs` in `tools/dynasty`. The start check covers phone/tablet/landscape, keyboard/touch, reduced
motion, all four profiles and unchanged individual pack/coin privileges.

Pack update: Standard and Starter cap at Epic (including Standard trainers); Team caps at Legendary. Mythic pulls are exclusive to Epic packs. Removed odds flow to the highest allowed tier. Preview groups rotate through the top 12 eligible players per stable profile on each Packs visit, stored separately from gameplay saves. Existing collections are unchanged.
