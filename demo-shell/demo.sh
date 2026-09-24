#!/usr/bin/env bash
# Launch (or stop, or check) a focused demo environment: the shell plus the Depot and Value
# Stream (front and back ends each). Five servers — exactly the ceiling Claude Code's preview
# manager allows — so this script is the reliable way to bring just that set up for a live
# demo, without starting the whole ecosystem the way scripts/start-all.sh (one level up) does.
#
#   ./demo.sh            start everything that isn't already up
#   ./demo.sh status     show what's listening
#   ./demo.sh stop       stop everything this script started
#   ./demo.sh restart    stop then start
#
# From Windows (PowerShell / cmd):  wsl -d Ubuntu -- bash -lc ~/conways-depot/demo-shell/demo.sh
#
# Lives inside conways-depot (moved here 2026-09-15 so `git clone conways-depot` brings the
# shell with it) — Value Stream still has to be cloned as a sibling under the same $HOME
# (see ../scripts/clone-all.sh) for its two entries below to have anything to start.

set -u

LOG_DIR="${TMPDIR:-/tmp}/demo-env"
PID_DIR="$LOG_DIR/pids"
mkdir -p "$PID_DIR"

# Node lives behind nvm — load it so `npm` is on PATH for the Vite servers.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

# name|port|working dir|command
SERVICES=(
  "demo-shell|5180|$HOME/conways-depot/demo-shell|python3 -m http.server 5180 --bind 0.0.0.0 --directory $HOME/conways-depot/demo-shell"
  "depot-backend|8090|$HOME/conways-depot/backend|DATA_DIR=$HOME/conways-depot/data .venv/bin/python app.py"
  "depot-frontend|5175|$HOME/conways-depot/frontend|npm run dev -- --host 0.0.0.0"
  "valuestream-backend|8080|$HOME/ValueStream/backend|.venv/bin/python app.py"
  "valuestream-frontend|5173|$HOME/ValueStream/frontend|npm run dev -- --host 0.0.0.0"
)

port_up() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- && return 0 || return 1; }

start_one() {
  local name=$1 port=$2 dir=$3 cmd=$4
  if port_up "$port"; then
    printf '  %-22s :%s  already up\n' "$name" "$port"
    return
  fi
  if [ ! -d "$dir" ]; then
    printf '  %-22s :%s  SKIPPED — %s missing\n' "$name" "$port" "$dir"
    return
  fi
  # setsid fully detaches the process so it survives this script and the terminal closing.
  # `env` so a leading VAR=value in $cmd (e.g. depot-backend's DATA_DIR) is applied instead of
  # being treated as the command to exec.
  setsid bash -c "cd '$dir' && exec env $cmd" >"$LOG_DIR/$name.log" 2>&1 &
  echo $! >"$PID_DIR/$name.pid"
  printf '  %-22s :%s  starting (log: %s/%s.log)\n' "$name" "$port" "$LOG_DIR" "$name"
}

cmd_start() {
  echo "Starting demo environment..."
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name port dir cmd <<<"$entry"
    start_one "$name" "$port" "$dir" "$cmd"
  done
  echo
  echo "Waiting for ports..."
  sleep 4
  cmd_status
  echo
  echo "Open  http://localhost:5180  to run the demo."
}

cmd_stop() {
  echo "Stopping demo environment..."
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name port dir cmd <<<"$entry"
    local pidfile="$PID_DIR/$name.pid"
    if [ -f "$pidfile" ]; then
      local pid; pid=$(cat "$pidfile")
      # Kill the whole process group setsid created (negative pid).
      kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null
      rm -f "$pidfile"
      printf '  %-22s stopped\n' "$name"
    fi
  done
  # Belt and braces: anything still holding a demo port.
  for port in 5180 8090 5175 8080 5173; do
    local held; held=$(ss -ltnpH "( sport = :$port )" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
    [ -n "${held:-}" ] && kill "$held" 2>/dev/null && printf '  freed port %s (pid %s)\n' "$port" "$held"
  done
}

cmd_status() {
  local all_up=1
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name port dir cmd <<<"$entry"
    if port_up "$port"; then
      printf '  %-22s :%-5s  UP\n' "$name" "$port"
    else
      printf '  %-22s :%-5s  down\n' "$name" "$port"
      all_up=0
    fi
  done
  [ "$all_up" = 1 ] && echo "  all ${#SERVICES[@]} up" || echo "  (some down — check logs in $LOG_DIR)"
}

case "${1:-start}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; echo; sleep 1; cmd_start ;;
  status)  cmd_status ;;
  *) echo "usage: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
