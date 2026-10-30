#!/bin/bash
# Installs dependencies at the start of Claude Code cloud sessions only.
# Local sessions skip it: you install dependencies yourself.
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1
stamp=node_modules/.install-deps.sha256

# Reinstall only when the lock file or this script changed.
if ! sha256sum --check --status "$stamp" 2>/dev/null; then
  rm -f "$stamp"
  if npm ci; then
    sha256sum scripts/install-deps.sh package.json package-lock.json > "$stamp" || rm -f "$stamp"
  fi
fi
exit 0
