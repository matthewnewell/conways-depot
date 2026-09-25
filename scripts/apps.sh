#!/usr/bin/env bash
# Shared app list for start-all.sh / stop-all.sh / status.sh — the same servers described in
# .claude/launch.json, just runnable directly in a terminal instead of through Claude Code's
# Browser-pane preview manager (which caps at 5 servers per worktree — this ecosystem has long
# since grown past that). Add a new app here and all three scripts pick it up.
#
# Each entry: "name|port|cwd|command". Paths use $HOME (expanded when this file is sourced), so the
# same list works for any WSL user: clone-all.sh puts every repo directly under $HOME.
APPS=(
  "value-stream-backend|8080|$HOME/ValueStream/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "value-stream-frontend|5173|$HOME/ValueStream/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "conways-depot-backend|8090|$HOME/conways-depot/backend|source .venv/bin/activate && DATA_DIR=$HOME/conways-depot/data python app.py"
  "conways-depot-frontend|5175|$HOME/conways-depot/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "the-fixer-backend|8092|$HOME/the-fixer/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "the-fixer-frontend|5177|$HOME/the-fixer/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "good-plan-backend|8093|$HOME/good-plan/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "good-plan-frontend|5178|$HOME/good-plan/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "scan-me-backend|8094|$HOME/scan-me/backend|.venv/bin/python app.py"
  "scan-me-frontend|5179|$HOME/scan-me/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "org-charts-backend|8095|$HOME/org-charts/backend|source .venv/bin/activate && DATA_DIR=$HOME/org-charts/data python app.py"
  "org-charts-frontend|5181|$HOME/org-charts/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "scope-manager-backend|8097|$HOME/scope-manager/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "scope-manager-frontend|5183|$HOME/scope-manager/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "labor-supply-demand-backend|8098|$HOME/labor-supply-demand/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "labor-supply-demand-frontend|5184|$HOME/labor-supply-demand/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "winmax-backend|8099|$HOME/winmax/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "winmax-frontend|5185|$HOME/winmax/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "task-master-backend|8100|$HOME/task-master/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "task-master-frontend|5186|$HOME/task-master/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "aarons-meadow-backend|8101|$HOME/aarons-meadow/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "aarons-meadow-frontend|5187|$HOME/aarons-meadow/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "marti-backend|8102|$HOME/marti/backend|AI_PROVIDER=depot .venv/bin/python app.py"
  "marti-frontend|5188|$HOME/marti/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "lets-have-a-meeting-frontend|5189|$HOME/lets-have-a-meeting/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "qms-frontend|5191|$HOME/qms/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "capability-models-frontend|5193|$HOME/capability-models/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "reckon-backend|8103|$HOME/reckon/backend|.venv/bin/python app.py"
  "reckon-frontend|5192|$HOME/reckon/frontend|source ~/.nvm/nvm.sh && npm run dev -- --host 0.0.0.0"
  "demo-shell|5180|$HOME/conways-depot/demo-shell|python3 -m http.server 5180 --bind 0.0.0.0"
)
# BurnedValue (port 5000) removed 2026-09-12 - being retired in favor of "Good Plan" (labor
# demand, built) + "Big Plan" (org-level capacity commitment, not built yet).

RUN_DIR="$(dirname "${BASH_SOURCE[0]}")/../.run"
LOG_DIR="$(dirname "${BASH_SOURCE[0]}")/../logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"
