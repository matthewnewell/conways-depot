#!/usr/bin/env bash
# Stop everything start-all.sh started. Kills the whole process group per app (so npm's child
# process, e.g. vite, dies too — not just the wrapper shell), then clears the pid file.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/apps.sh"

for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  pidfile="$RUN_DIR/$name.pid"

  if [[ ! -f "$pidfile" ]]; then
    echo "  [skip]  $name — no pid file (not started by this script)"
    continue
  fi

  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    echo "  [stop]  $name (pid $pid)"
  else
    echo "  [skip]  $name — pid $pid not running"
  fi
  rm -f "$pidfile"
done
