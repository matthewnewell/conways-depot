#!/usr/bin/env bash
# Start the whole ecosystem: every app's dev server plus the demo shell, run directly in WSL,
# outside Claude Code's Browser-pane preview manager (which caps at 5 servers per worktree).
# This is the one command behind "start all". It's meant to work on a fresh clone, on a machine
# that has fallen behind, and in a browser holding an old cache:
#
#   1. Missing repos           -> scripts/clone-all.sh
#   2. Missing venvs/node deps -> scripts/bootstrap.sh (which also refreshes the shared drawer)
#   3. Stale shared drawer     -> scripts/refresh-drawer.sh, then restarts running frontends
#   4. Demo data changed       -> scripts/reset-demo-data.sh: every app's database moves to
#      <app>/data-backup/ and each app reseeds (apps only seed an EMPTY database, so pulled
#      demo-data changes would otherwise never show up). Triggered when scripts/demo-data-version
#      differs from this machine's stamp in data/.demo-data-version.
#   5. Starts anything not already listening, waits until every port answers, retries anything
#      that died once, and exits non-zero (with log tails) if something still isn't up.
#
# Browser caches can't serve a stale drawer: every app's vite.config uses conwaysDrawer() from
# @conways/drawer/vite, which changes Vite's dep URLs whenever the drawer's contents change.
#
#   scripts/start-all.sh            start what isn't running
#   scripts/start-all.sh --restart  stop everything this script started, then start fresh
#
# status.sh shows what's up; stop-all.sh tears it all down.
set -uo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPTS/apps.sh"

WAIT_SECS=90
DRAWER="$HOME/conways-drawer"

port_up() { ss -ltn 2>/dev/null | grep -q ":$1 "; }
pid_alive() { [[ -f "$RUN_DIR/$1.pid" ]] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null; }

stop_one() {
  local name=$1 pidfile="$RUN_DIR/$1.pid"
  if pid_alive "$name"; then
    kill -TERM -"$(cat "$pidfile")" 2>/dev/null || kill -TERM "$(cat "$pidfile")" 2>/dev/null
  fi
  rm -f "$pidfile"
}

start_one() {
  local name=$1 port=$2 cwd=$3 cmd=$4
  # setsid makes this process its own session/group leader, so stop-all.sh can kill the whole
  # group (npm's own child, e.g. vite) with one `kill -- -PID`, not just the shell wrapper.
  setsid bash -c "cd '$cwd' && $cmd" > "$LOG_DIR/$name.log" 2>&1 < /dev/null &
  echo "$!" > "$RUN_DIR/$name.pid"
  echo "  [start] $name (pid $!, port $port)"
}

if [[ "${1:-}" == "--restart" ]]; then
  echo "== Stopping everything first"
  bash "$SCRIPTS/stop-all.sh"
  sleep 2
  echo
fi

# ---- 1. Repos -------------------------------------------------------------------------------
missing_repo=0
[[ -d "$DRAWER" ]] || missing_repo=1
for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  [[ -d "$cwd" ]] || missing_repo=1
done
if (( missing_repo )); then
  echo "== Some repos aren't cloned yet — running clone-all.sh"
  bash "$SCRIPTS/clone-all.sh"
  echo
fi

# ---- 2. Dependencies ------------------------------------------------------------------------
needs_bootstrap=0
for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  [[ -d "$cwd" ]] || continue
  [[ "$cwd" == */backend && ! -x "$cwd/.venv/bin/python" ]] && needs_bootstrap=1
  [[ "$cwd" == */frontend && ! -d "$cwd/node_modules" ]] && needs_bootstrap=1
done

# ---- 3. Shared drawer freshness ---------------------------------------------------------------
# A frontend's installed copy must match ~/conways-drawer exactly (dist/ + the vite plugin).
drawer_stale() {
  local installed="$1/node_modules/@conways/drawer"
  [[ -d "$installed" ]] || return 0
  diff -rq "$DRAWER/dist" "$installed/dist" >/dev/null 2>&1 || return 0
  cmp -s "$DRAWER/vite-plugin.js" "$installed/vite-plugin.js" || return 0
  return 1
}
stale_drawer=0
if [[ -d "$DRAWER/dist" ]]; then
  for entry in "${APPS[@]}"; do
    IFS='|' read -r name port cwd cmd <<< "$entry"
    [[ "$cwd" == */frontend && -d "$cwd/node_modules" ]] || continue
    grep -q '@conways/drawer' "$cwd/package.json" 2>/dev/null || continue
    drawer_stale "$cwd" && stale_drawer=1
  done
fi

if (( needs_bootstrap )); then
  echo "== Missing dependencies — running bootstrap.sh (a few minutes on a fresh machine)"
  bash "$SCRIPTS/bootstrap.sh" || echo "  (bootstrap reported problems — starting what we can)"
  stale_drawer=1   # bootstrap refreshed the drawer; running frontends must restart to pick it up
  echo
elif (( stale_drawer )); then
  echo "== Shared drawer changed — refreshing every app's copy"
  bash "$SCRIPTS/refresh-drawer.sh" | grep -v '^\s*$' | grep -v 'IMPORTANT\|stale bundle\|until it.s restarted'
  echo
fi

if (( stale_drawer )); then
  # A Vite server started before the refresh keeps serving the old pre-bundle; restart ours.
  for entry in "${APPS[@]}"; do
    IFS='|' read -r name port cwd cmd <<< "$entry"
    [[ "$cwd" == */frontend ]] && pid_alive "$name" && { stop_one "$name"; echo "  [stop]  $name (drawer changed)"; }
  done
  sleep 2
fi

# ---- 4. Demo data version ---------------------------------------------------------------------
VERSION_FILE="$SCRIPTS/demo-data-version"
STAMP="$SCRIPTS/../data/.demo-data-version"
want="$(tr -d '[:space:]' < "$VERSION_FILE" 2>/dev/null)"
have="$(tr -d '[:space:]' < "$STAMP" 2>/dev/null)"
reseeded=0
if [[ -n "$want" && "$want" != "$have" ]]; then
  echo "== Demo data is version $want; this machine has ${have:-none}. Reseeding every app"
  echo "   (existing databases move to <app>/data-backup/<timestamp>/, nothing is deleted)"
  bash "$SCRIPTS/stop-all.sh" >/dev/null 2>&1
  sleep 2
  bash "$SCRIPTS/reset-demo-data.sh" --move-only
  reseeded=1
  echo
fi

# ---- 5. Start, wait, retry --------------------------------------------------------------------
echo "== Starting servers"
for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  if pid_alive "$name"; then
    echo "  [skip]  $name already running (port $port)"
  elif port_up "$port"; then
    echo "  [skip]  $name — port $port is held by a process this script didn't start"
  elif [[ ! -d "$cwd" ]]; then
    echo "  [FAIL]  $name — $cwd not found"
  else
    start_one "$name" "$port" "$cwd" "$cmd"
  fi
done

wait_for_ports() {
  local deadline=$(( SECONDS + WAIT_SECS )) pending
  while (( SECONDS < deadline )); do
    pending=0
    for entry in "${APPS[@]}"; do
      IFS='|' read -r name port cwd cmd <<< "$entry"
      port_up "$port" || pending=1
    done
    (( pending )) || return 0
    sleep 2
  done
  return 1
}

echo
echo "== Waiting for every port to answer (up to ${WAIT_SECS}s)"
if ! wait_for_ports; then
  retried=0
  for entry in "${APPS[@]}"; do
    IFS='|' read -r name port cwd cmd <<< "$entry"
    if ! port_up "$port" && [[ -d "$cwd" ]]; then
      echo "  [retry] $name wasn't up — restarting it once"
      stop_one "$name"
      start_one "$name" "$port" "$cwd" "$cmd"
      retried=1
    fi
  done
  (( retried )) && wait_for_ports
fi

# ---- Report -------------------------------------------------------------------------------------
down=()
for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  port_up "$port" || down+=("$name")
done

echo
if (( ${#down[@]} == 0 )); then
  # Only stamp once everything came up, so a failed run tries the reseed again next time.
  if (( reseeded )); then
    mkdir -p "$(dirname "$STAMP")" && echo "$want" > "$STAMP"
    echo "Demo data reseeded to version $want."
  fi
  echo "All ${#APPS[@]} servers are up. Open the demo at http://localhost:5180"
  exit 0
fi
echo "${#down[@]} of ${#APPS[@]} servers are NOT up:"
for name in "${down[@]}"; do
  echo "  - $name (last lines of logs/$name.log):"
  tail -n 5 "$LOG_DIR/$name.log" 2>/dev/null | sed 's/^/      /'
done
exit 1
