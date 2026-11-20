#!/usr/bin/env bash
set -euo pipefail

POLICY_FILE="src/authorization.js"
BACKUP_FILE="$(mktemp)"
cp "$POLICY_FILE" "$BACKUP_FILE"

restore_policy() {
  cp "$BACKUP_FILE" "$POLICY_FILE"
  rm -f "$BACKUP_FILE"
}
trap restore_policy EXIT INT TERM

python3 - "$POLICY_FILE" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
source = path.read_text()
needle = 'return Boolean(user.branchId && user.branchId === order.branchId);'
if needle not in source:
    raise SystemExit('Could not find the branch policy line; no change was made.')
path.write_text(source.replace(needle, 'return true; // intentional temporary policy failure for the negative test', 1))
PY

echo '=== Expected failing tests while canAccessOrder allows everyone ==='
set +e
npm test
broken_status=$?
set -e
if [ "$broken_status" -eq 0 ]; then
  echo 'ERROR: the tests unexpectedly passed with the branch policy removed.'
  exit 1
fi

restore_policy
trap - EXIT INT TERM
echo '=== Re-running tests after restoring the branch policy ==='
npm test
