#!/usr/bin/env bash
# Clones every sibling repo into $HOME in one shot — for setting up a new machine (e.g. at
# work) instead of cloning each one by hand. Safe to re-run: skips any directory that's already
# a git repo. After cloning, each app still needs its own one-time setup (backend venv + `pip
# install`, frontend `npm install`) per its own README before scripts/start-all.sh can run it.
#
# Bootstrapping note: this script itself lives in conways-depot, so on a genuinely empty
# machine you need `git clone https://github.com/matthewnewell/conways-depot.git` once by hand
# first, then run this for everything else. Worth keeping a standalone copy (a gist, your
# dotfiles) if you want to skip even that first manual clone.
set -uo pipefail

# Never prompt for credentials on a private/nonexistent repo — fail fast instead of hanging
# forever waiting for a username on a non-interactive terminal.
export GIT_TERMINAL_PROMPT=0

GITHUB_USER="matthewnewell"
BASE_DIR="$HOME"

# All same-named on GitHub as their local directory except ValueStream's own casing. Keep in
# sync with scripts/apps.sh's directory list when a new app is added.
REPOS=(
  "ValueStream"
  "conways-depot"
  "dude-wheres-my-part"
  "the-fixer"
  "good-plan"
  "scan-me"
  "org-charts"
  "dude-wheres-my-order"
  "scope-manager"
  "labor-supply-demand"
  "winmax"
  "task-master"
  "aarons-meadow"
  "marti"
  # keep in sync with scripts/apps.sh whenever a new app is added
)

failed=()
for name in "${REPOS[@]}"; do
  target="$BASE_DIR/$name"
  if [[ -d "$target/.git" ]]; then
    echo "  [skip]  $name already cloned"
    continue
  fi
  if git clone -q "https://github.com/$GITHUB_USER/$name.git" "$target" 2>/dev/null; then
    echo "  [clone] $name"
  else
    echo "  [FAIL]  $name — not reachable (private, renamed, or not pushed yet?)"
    failed+=("$name")
  fi
done

echo
echo "Next: follow each app's own README for one-time setup (backend venv, frontend npm install), then scripts/start-all.sh."
echo "(demo-shell — the combined-demo parent frame — lives inside conways-depot/demo-shell, no separate step needed.)"
if [[ ${#failed[@]} -gt 0 ]]; then
  echo
  echo "Could not clone: ${failed[*]}"
fi
