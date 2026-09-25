#!/usr/bin/env bash
# Start every app from fresh demo data. For a machine whose databases predate the current demo
# story (an older clone that has been pulled forward): each app only seeds an EMPTY database, so
# after a pull its old data stays and new demo data never appears. This moves every app's
# database aside (nothing is deleted) and restarts, so each app seeds itself fresh.
#
#   scripts/reset-demo-data.sh              # asks first
#   scripts/reset-demo-data.sh --yes        # no prompt
#   scripts/reset-demo-data.sh --move-only  # just move the databases aside (start-all.sh uses
#                                           # this; it has already stopped the servers)
#
# start-all.sh runs this by itself when scripts/demo-data-version changes, so a machine that
# pulls new demo data gets it on the next "start all".
#
# Backups land in <app>/data-backup/<timestamp>/ (gitignored). To go back, stop everything and
# move the files back into <app>/data/.
set -uo pipefail
HERE="$(dirname "${BASH_SOURCE[0]}")"
source "$HERE/apps.sh"

MOVE_ONLY=0
[[ "${1:-}" == "--move-only" ]] && MOVE_ONLY=1

if [[ "${1:-}" != "--yes" ]] && (( ! MOVE_ONLY )); then
  read -r -p "Move every app's database aside and reseed from demo data? [y/N] " answer
  [[ "$answer" == [yY]* ]] || { echo "Nothing changed."; exit 0; }
fi

if (( ! MOVE_ONLY )); then
  bash "$HERE/stop-all.sh" >/dev/null 2>&1 || true
  sleep 1
fi

stamp="$(date +%Y%m%d-%H%M%S)"
seen=()
for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  [[ "$cwd" == */backend ]] || continue
  app_dir="${cwd%/backend}"
  [[ " ${seen[*]} " == *" $app_dir "* ]] && continue
  seen+=("$app_dir")
  shopt -s nullglob
  dbs=("$app_dir"/data/*.db "$app_dir"/data/*.db-wal "$app_dir"/data/*.db-shm)
  shopt -u nullglob
  if [[ ${#dbs[@]} -eq 0 ]]; then
    echo "  [none]  $(basename "$app_dir") — no database yet"
    continue
  fi
  mkdir -p "$app_dir/data-backup/$stamp"
  mv "${dbs[@]}" "$app_dir/data-backup/$stamp/"
  echo "  [moved] $(basename "$app_dir") → data-backup/$stamp/"
done

(( MOVE_ONLY )) && exit 0

echo
bash "$HERE/start-all.sh"
echo
echo "Every app is reseeding from its demo data. Give the backends a few seconds, then scripts/status.sh."
