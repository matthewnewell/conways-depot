#!/usr/bin/env bash
# One-shot setup for a fresh machine (or a machine that's drifted): run AFTER scripts/clone-all.sh.
#
#   scripts/clone-all.sh      # get every repo
#   scripts/bootstrap.sh      # venvs, pip/npm installs, the shared drawer, .env stub, health hints
#   scripts/start-all.sh      # run everything
#
# Safe to re-run — it only fills in what's missing/out of date, never overwrites a .env, and keeps
# going past a failing app so one bad install doesn't hide the rest (failures are listed at the end).
# The app list comes from scripts/apps.sh, so a newly registered app is picked up automatically.
#
# Flags:  --check   just report what's missing (no installs)
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/apps.sh"

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

failed=()
ok()   { echo "  [ok]    $*"; }
info() { echo "  [....]  $*"; }
bad()  { echo "  [FAIL]  $*"; failed+=("$*"); }

echo "== Prerequisites"
command -v git >/dev/null      && ok "git"      || bad "git is not installed"
command -v python3 >/dev/null  && ok "python3 ($(python3 --version 2>&1 | cut -d' ' -f2))" || bad "python3 is not installed"
if ! python3 -c "import venv, ensurepip" 2>/dev/null; then
  bad "python3 venv support missing — on Ubuntu/WSL: sudo apt install python3-venv python3-pip"
fi
# Node comes from nvm in this ecosystem (start-all.sh sources it too).
# shellcheck disable=SC1090
source ~/.nvm/nvm.sh 2>/dev/null || true
if command -v npm >/dev/null; then ok "node $(node --version) / npm $(npm --version)"; else
  bad "node/npm not found — install nvm (https://github.com/nvm-sh/nvm) then: nvm install --lts"
fi

if [[ ! -d "$HOME/conways-drawer/dist" ]]; then
  bad "~/conways-drawer is missing or unbuilt — run scripts/clone-all.sh (frontends depend on it via file:../../conways-drawer)"
fi

echo
echo "== Backends (venv + pip install)"
for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  [[ "$cwd" == */backend ]] || continue
  app_dir="${cwd%/backend}"
  if [[ ! -d "$cwd" ]]; then bad "$name — $cwd not found (not cloned?)"; continue; fi
  req="$cwd/requirements.txt"
  [[ -f "$cwd/requirements-dev.txt" ]] && req="$cwd/requirements-dev.txt"
  if [[ ! -f "$req" ]]; then bad "$name — no requirements file"; continue; fi
  if (( CHECK_ONLY )); then
    [[ -x "$cwd/.venv/bin/python" ]] && ok "$name venv" || bad "$name — no venv yet"
    continue
  fi
  if [[ ! -x "$cwd/.venv/bin/python" ]]; then
    info "$name — creating venv"
    (cd "$cwd" && python3 -m venv .venv) || { bad "$name — venv creation failed"; continue; }
  fi
  if (cd "$cwd" && .venv/bin/pip install -q -r "$(basename "$req")" >/dev/null 2>&1); then
    ok "$name"
  else
    bad "$name — pip install failed (run it by hand in $cwd to see why)"
  fi
done

echo
echo "== Frontends (npm install)"
for entry in "${APPS[@]}"; do
  IFS='|' read -r name port cwd cmd <<< "$entry"
  [[ "$cwd" == */frontend ]] || continue
  if [[ ! -d "$cwd" ]]; then bad "$name — $cwd not found (not cloned?)"; continue; fi
  if (( CHECK_ONLY )); then
    [[ -d "$cwd/node_modules" ]] && ok "$name node_modules" || bad "$name — no node_modules yet"
    continue
  fi
  if (cd "$cwd" && npm install --silent >/dev/null 2>&1); then ok "$name"; else
    bad "$name — npm install failed (run it by hand in $cwd to see why)"
  fi
done

echo
echo "== Shared drawer (force a fresh copy into every app that uses it)"
if (( CHECK_ONLY )); then
  info "skipped in --check mode"
else
  bash "$(dirname "${BASH_SOURCE[0]}")/refresh-drawer.sh" || bad "refresh-drawer.sh reported errors"
fi

echo
echo "== Conway's Depot AI config (backend/.env)"
ENV_FILE="$HOME/conways-depot/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  ok "backend/.env exists (left untouched)"
elif (( CHECK_ONLY )); then
  bad "backend/.env missing — the Depot holds the one AI key every other app proxies through"
else
  cat > "$ENV_FILE" <<'EOF'
# The Depot is the one instance with real AI credentials; every other app runs AI_PROVIDER=depot
# and proxies through it (see scripts/apps.sh). Uncomment ONE provider and fill in the key.
# This file is gitignored — never commit it.
#
# AI_PROVIDER=claude
# AI_PROVIDER=gemini
# AI_PROVIDER=ollama
# AI_API_KEY=
# AI_MODEL=
# AI_BASE_URL=http://localhost:11434   # ollama only
EOF
  info "wrote a commented template to $ENV_FILE — edit it, then restart the Depot backend"
fi

echo
if [[ ${#failed[@]} -gt 0 ]]; then
  echo "Finished with ${#failed[@]} problem(s):"
  printf '  - %s\n' "${failed[@]}"
  exit 1
fi
echo "All set. Next: scripts/start-all.sh, then scripts/status.sh (everything should read 'up')."
