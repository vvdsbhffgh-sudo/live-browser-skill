#!/usr/bin/env bash
# update-deps — update Atlas dependencies, tested, with rollback.
#
# Usage: npm run update-deps   (or: bash scripts/update-deps.sh)
#
# 1. Backs up package.json + package-lock.json.
# 2. If npm-check-updates (ncu) is available, updates package.json and
#    runs npm install. Otherwise prints `npm outdated` and updates NOTHING.
# 3. Runs npm test as the gate.
# 4. On test failure, restores the backup, runs npm ci, and exits non-zero.
# Never updates blindly to latest without the test gate (see docs/UPDATES.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/live/deps-backup-$STAMP"
mkdir -p "$BACKUP_DIR"
cp package.json package-lock.json "$BACKUP_DIR/"
echo "Backup saved to $BACKUP_DIR"

rollback() {
  echo "TESTS FAILED — rolling back to the backup."
  cp "$BACKUP_DIR/package.json" "$BACKUP_DIR/package-lock.json" "$ROOT/"
  npm ci --no-audit --no-fund || true
  echo "Rolled back. package.json / package-lock.json restored from $BACKUP_DIR"
  exit 1
}

if command -v ncu >/dev/null 2>&1 || npx --no-install npm-check-updates --version >/dev/null 2>&1; then
  echo "npm-check-updates found — updating package.json to latest in-range versions…"
  npx -y npm-check-updates -u
  npm install --no-audit --no-fund
else
  echo "npm-check-updates is NOT installed — updating nothing automatically."
  echo "Install it with: npm install -g npm-check-updates"
  echo "Current outdated packages (review manually):"
  npm outdated || true
  echo "Done. No files changed."
  exit 0
fi

echo "Running the test gate (npm test)…"
if npm test; then
  echo "Tests green. Update kept."
  echo "If Playwright was updated, also run: npx playwright install chromium"
  echo "Backup kept at $BACKUP_DIR (delete it when you are happy)."
else
  rollback
fi
