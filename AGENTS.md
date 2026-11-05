# Project instructions

Read and follow CLAUDE.md for the existing app rules and deployment process.

All new app changes are restricted to Evan Appenzeller's existing owner profile (`data.isOwner()`,
stable manager ID `evan`) unless the user explicitly authorizes wider rollout. This applies across
the whole app, not only Return Man. Other profiles and unselected/guest users retain existing behavior.
Use the existing profile mechanism; do not claim it is verified authentication or match display names.

The owner explicitly authorized the Gridiron Hub v3.0 rollout to everyone on October 22, 2026.
Its existing Keepfall, Return Man, game presentation and navigation features are now shared baseline behavior
(`core/features.js`). Scoreboards, pictures and Keepfall show everyone to everyone since Oct 24, 2026 (CLAUDE.md).

The owner explicitly authorized all completed Return Man updates for every player on November 5, 2026.
Its movement, course/scenery, jetpack, scoring, pursuit, title/intro and pickup presentation are shared baseline
(`features.returnManUpdated()`). This exception does not open other app pilots or owner tools.
The November 5 follow-up explicitly includes every Return Man change for all user accounts, including smelling
salts expiring with their speed boost. Do not keep Return Man gameplay or presentation behind owner-only gates.

## Rivals league preview (November 5, 2026)

Evan authorized the Gridiron Rivals case for every league member. Only Evan (`evan`), Jayton Hull
(`jayton`), Ryan Stewart (`ryan-stewart`) and Ryan Younggreen (`ryan-younggreen`) may play.
Other league members see a Coming Soon sticker and cannot open the game. Unselected profiles,
ordinary guests and other app users retain their previous shelf. `features.dynastyOpen()` and
`dynastyKey()` govern routes, saves and opponents; `gamesFor()` separately governs case visibility.
Profile changes close the case and cancel pending launches. This uses the existing local profile
selection, not verified per-person authentication. Preserve owner tools, pack/coin privileges and saves.
Verify `node --experimental-vm-modules tools/dynasty/check-preview.cjs` and the existing access checks.
