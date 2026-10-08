# Yahoo sync

`.github/workflows/yahoo-sync.yml` runs `sync.py` twice a day. It copies the league's final scores, next
games, team names and Yahoo's projections for the current week into `data/league.json`, then commits and
publishes it. The app picks up the new file on its next refresh, and standings, power rankings, playoff
odds and the Matchup tab all follow from it.

## One-time setup

1. **Make a Yahoo app.** Go to https://developer.yahoo.com/apps/create/ while signed in to the Yahoo
   account that's in the league.
   - Application name: `Gridiron Gangbang`
   - Homepage URL: `https://evanappenzeller-ui.github.io/gridiron-gangbang`
   - Redirect URI: `https://evanappenzeller-ui.github.io/gridiron-gangbang/yahoo.html`
   - OAuth client type: **Confidential Client**
   - API permissions: **Fantasy Sports - Read**
   Create it, and keep the **Client ID** and **Client Secret** it shows.
2. **Save the keys in GitHub.** In the repo, go to Settings > Secrets and variables > Actions > New
   repository secret. Add `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET`.
3. **Get the sign-in link.** Go to Actions > Yahoo sync > Run workflow and leave the code blank. When the
   run finishes, open it: the summary has a Yahoo link.
4. **Connect.** Open the link and tap Agree. Yahoo sends you to the app's `yahoo.html` page, which shows
   the code with a Copy button. Run the workflow again with the code pasted in. It saves the login and
   syncs straight away. Yahoo's codes expire within minutes, so do this step promptly.

If the Yahoo app's redirect URI is ever something else, add a repository **variable** (not a secret),
`YAHOO_REDIRECT_URI`, with exactly the same value.

If the account has more than one NFL league and none is named like the league in `league.json`, add a
repository variable `YAHOO_LEAGUE_ID` with the number from the league's Yahoo address (`.../f1/123456`).

## Files

- `sync.py`: the sync. The top of the file explains its commands (`link`, `connect`, `sync`).
- `token.enc`: the Yahoo login, encrypted with the client secret. Delete it and reconnect to start over.
- `teams.json`: which Yahoo team is which manager, matched automatically once a season. Edit it if a
  match is ever wrong.
