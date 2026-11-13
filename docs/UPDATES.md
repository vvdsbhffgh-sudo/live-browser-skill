# Updating dependencies — tested, never blind

Atlas depends on three npm packages (`@modelcontextprotocol/sdk`,
`playwright`, `zod`) plus the Node.js runtime. Dependencies are updated
deliberately, with the test suite as the gate — never by blindly jumping
to the latest version.

## The command

```bash
npm run update-deps   # runs scripts/update-deps.sh
```

What the script does, in order:

1. **Backs up** `package.json` and `package-lock.json` (copies in `live/`,
   git-ignored, plus a timestamped copy).
2. **Checks for updates:**
   - If `npm-check-updates` (`ncu`) is available, it updates `package.json`
     to the latest versions within your semver ranges and runs `npm install`.
   - If `ncu` is **not** available, it runs `npm outdated` and prints the
     list for you to review — it updates nothing on its own.
3. **Runs the gate:** `npm test`. All tests must pass.
4. **On failure, it rolls back:** the backup `package.json` and
   `package-lock.json` are restored, `npm ci` is run, and the script exits
   non-zero with a clear message. The repo is left exactly as it was.
5. **On success,** it prints the new versions and reminds you to also run
   `npx playwright install chromium` if Playwright itself was updated
   (browser binaries are version-matched to the package).

## Rules

- **No blind update to latest.** A major-version jump (e.g. MCP SDK v1 →
  v2, Playwright with a breaking API change) is reviewed by a human first:
  read the upstream changelog, update the code if the API changed, then
  run the tests. The script only automates the mechanical part.
- **Never update on the day of a demo or a publish.** Update, test, then
  use — in that order.
- **Pin what matters:** `package-lock.json` is committed, so a fresh
  `npm ci` reproduces exactly the versions that passed the tests.
- **Playwright browsers:** after a Playwright update, reinstall the
  browser (`npx playwright install chromium`) — the old binary may not
  match the new package.
- **Security updates:** a `npm audit` finding is fixed the same way —
  update, test, roll back on failure. A failing test after a security
  update is a reason to *read the change*, not to skip the tests.

## Manual alternative

```bash
npm outdated            # see what is newer
npm update              # update within semver ranges
npm test                # gate — must stay green
npx playwright install chromium   # if Playwright changed
```
