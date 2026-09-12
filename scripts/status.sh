#!/usr/bin/env bash
# Show which apps are actually listening, independent of whether start-all.sh started them
# (a server you launched by hand, or through Claude Code's preview tool, shows up too).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/apps.sh"

printf "%-26s %-6s %-8s %s\n" "APP" "PORT" "STATUS" "PID (if started by this script)"
for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  pidfile="$RUN_DIR/$name.pid"
  pid=""
  [[ -f "$pidfile" ]] && pid="$(cat "$pidfile")"

  if ss -ltn 2>/dev/null | grep -q ":$port "; then
    status="up"
  else
    status="down"
  fi
  printf "%-26s %-6s %-8s %s\n" "$name" "$port" "$status" "${pid:-—}"
done
