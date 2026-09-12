#!/usr/bin/env bash
# Start every sibling app's dev server directly in this WSL shell — outside Claude Code's own
# Browser-pane preview manager, which caps at 5 concurrent servers per worktree. Run this in
# your own terminal, then open each app in your own browser tab; `status.sh` shows what's up
# and `stop-all.sh` tears it all down again.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/apps.sh"

for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  pidfile="$RUN_DIR/$name.pid"

  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "  [skip]  $name already running (pid $(cat "$pidfile"), port $port)"
    continue
  fi

  if ss -ltn 2>/dev/null | grep -q ":$port "; then
    echo "  [skip]  $name — something's already listening on port $port (not started by this script)"
    continue
  fi

  # setsid makes this process its own session/group leader, so stop-all.sh can kill the whole
  # group (npm's own child, e.g. vite) with one `kill -- -PID`, not just the shell wrapper.
  setsid bash -c "cd '$cwd' && $cmd" > "$LOG_DIR/$name.log" 2>&1 < /dev/null &
  pid=$!
  echo "$pid" > "$pidfile"
  echo "  [start] $name (pid $pid, port $port) — log: logs/$name.log"
done

echo
echo "Run scripts/status.sh to check readiness, scripts/stop-all.sh to shut everything down."
