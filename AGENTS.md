# Project instructions

Read and follow CLAUDE.md for the existing app rules and deployment process.

All new app changes are restricted to Evan Appenzeller's existing owner profile (`data.isOwner()`,
stable manager ID `evan`) unless the user explicitly authorizes wider rollout. This applies across
the whole app, not only Return Man. Other profiles and unselected/guest users retain existing behavior.
Use the existing profile mechanism; do not claim it is verified authentication or match display names.

The owner explicitly authorized the Gridiron Hub v3.0 rollout to everyone on October 22, 2026.
Its existing Keepfall, Return Man, game presentation and navigation features are now shared baseline behavior
(`core/features.js`). Preserve the owner's privilege for avatar visibility; scoreboards show everyone to everyone since Oct 24, 2026 (CLAUDE.md).
