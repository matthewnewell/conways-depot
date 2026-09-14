#!/usr/bin/env bash
# Shared app list for start-all.sh / stop-all.sh / status.sh — the same servers described in
# .claude/launch.json, just runnable directly in a terminal instead of through Claude Code's
# Browser-pane preview manager (which caps at 5 servers per worktree — this ecosystem has long
# since grown past that). Add a new app here and all three scripts pick it up.
#
# Each entry: "name|port|cwd|command"
APPS=(
  "value-stream-backend|8080|/home/matthew/ValueStream/backend|.venv/bin/python app.py"
  "value-stream-frontend|5173|/home/matthew/ValueStream/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "conways-depot-backend|8090|/home/matthew/conways-depot/backend|source .venv/bin/activate && DATA_DIR=/home/matthew/conways-depot/data python app.py"
  "conways-depot-frontend|5175|/home/matthew/conways-depot/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "dwmp-backend|8091|/home/matthew/dude-wheres-my-part/backend|.venv/bin/python app.py"
  "dwmp-frontend|5176|/home/matthew/dude-wheres-my-part/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "the-fixer-backend|8092|/home/matthew/the-fixer/backend|.venv/bin/python app.py"
  "the-fixer-frontend|5177|/home/matthew/the-fixer/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "good-plan-backend|8093|/home/matthew/good-plan/backend|.venv/bin/python app.py"
  "good-plan-frontend|5178|/home/matthew/good-plan/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "scan-me-backend|8094|/home/matthew/scan-me/backend|.venv/bin/python app.py"
  "scan-me-frontend|5179|/home/matthew/scan-me/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "org-charts-backend|8095|/home/matthew/org-charts/backend|source .venv/bin/activate && DATA_DIR=/home/matthew/org-charts/data python app.py"
  "org-charts-frontend|5181|/home/matthew/org-charts/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "dwmo-backend|8096|/home/matthew/dude-wheres-my-order/backend|source .venv/bin/activate && DATA_DIR=/home/matthew/dude-wheres-my-order/data python app.py"
  "dwmo-frontend|5182|/home/matthew/dude-wheres-my-order/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "scope-manager-backend|8097|/home/matthew/scope-manager/backend|.venv/bin/python app.py"
  "scope-manager-frontend|5183|/home/matthew/scope-manager/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "labor-supply-demand-backend|8098|/home/matthew/labor-supply-demand/backend|.venv/bin/python app.py"
  "labor-supply-demand-frontend|5184|/home/matthew/labor-supply-demand/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "winmax-backend|8099|/home/matthew/winmax/backend|.venv/bin/python app.py"
  "winmax-frontend|5185|/home/matthew/winmax/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "demo-shell|5180|/home/matthew/demo-shell|python3 -m http.server 5180 --bind 0.0.0.0"
)
# BurnedValue (port 5000) removed 2026-09-12 - being retired in favor of "Good Plan" (labor
# demand, built) + "Big Plan" (org-level capacity commitment, not built yet).

RUN_DIR="$(dirname "${BASH_SOURCE[0]}")/../.run"
LOG_DIR="$(dirname "${BASH_SOURCE[0]}")/../logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"
