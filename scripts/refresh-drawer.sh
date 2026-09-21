#!/usr/bin/env bash
# Re-installs the shared @conways/drawer package into every app that uses it. Run this after
# changing conways-drawer (and after `npm run build` + commit there) — a plain `npm install` in
# an app does NOT recopy a file: dependency whose version number hasn't changed, and Vite's own
# pre-bundle cache (node_modules/.vite) keeps serving the old CSS/JS, so an app can silently keep
# an old drawer. This forces a fresh copy and clears that cache; restart the app's dev server
# afterward (scripts/stop-all.sh && scripts/start-all.sh, or just the frontend).
set -uo pipefail
source ~/.nvm/nvm.sh 2>/dev/null || true

APPS=(conways-depot ValueStream marti winmax the-fixer task-master good-plan aarons-meadow labor-supply-demand org-charts scan-me scope-manager lets-have-a-meeting portfolio-manager qms reckon)  # apps using @conways/drawer

for app in "${APPS[@]}"; do
  dir="$HOME/$app/frontend"
  [[ -d "$dir" ]] || { echo "  [skip]  $app — not cloned"; continue; }
  (
    cd "$dir"
    rm -rf node_modules/@conways node_modules/.vite
    npm install --silent >/dev/null 2>&1
    if grep -q 'cd-rail' node_modules/@conways/drawer/dist/drawer.css 2>/dev/null; then
      echo "  [ok]    $app"
    else
      echo "  [FAIL]  $app — drawer not installed (is ~/conways-drawer cloned and built?)"
    fi
  )
done
echo
echo "IMPORTANT: restart every running frontend dev server now (scripts/stop-all.sh && scripts/start-all.sh)."
echo "A server left running keeps serving stale bundle URLs — the page goes blank with"
echo "'504 Outdated Optimize Dep' in the console until it's restarted."
