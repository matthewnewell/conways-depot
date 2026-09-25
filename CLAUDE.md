# Conway's Depot — agent notes

Conway's Depot is the hub of a ~17-app ecosystem. Each app lives in its own repo, cloned side by
side directly under `$HOME` in WSL Ubuntu. The app list and ports are in `scripts/apps.sh`.

## "Start all" / "start everything" / "start the demo" / "bring it up"

Run exactly one command. It handles a fresh clone, a machine that has fallen behind, and
browsers with an old cache on its own:

```bash
~/conways-depot/scripts/start-all.sh
```

From Windows (PowerShell, cmd, or Claude Code's Git Bash), go through WSL:

```bash
wsl -d Ubuntu -- bash -lc "~/conways-depot/scripts/start-all.sh"
```

- If sibling repos are missing, it clones them (`clone-all.sh`). If venvs or `node_modules` are
  missing, it installs them (`bootstrap.sh`). If a frontend's copy of the shared
  `@conways/drawer` package is out of date, it refreshes that copy and restarts the frontend.
- If the demo data version (`scripts/demo-data-version`) differs from this machine's stamp
  (`data/.demo-data-version`), it moves every app's database to `<app>/data-backup/<timestamp>/`
  and lets each app reseed. Apps only seed an empty database, so without this a machine that
  pulls new demo data (pins, projects, plans) keeps its old data. Nothing is deleted.
- It doesn't pull. On a machine that already has the repos, "start all" after new commits means
  pulling every repo first:
  `for d in ~/*/; do [ -d "$d/.git" ] && git -C "$d" pull --ff-only; done`
- It waits until every port answers, retries anything that died once, and ends with either
  `All N servers are up. Open the demo at http://localhost:5180` (exit 0) or a list of what's
  down with log tails (exit 1). Report that final line to the user. If something is down, read
  `~/conways-depot/logs/<name>.log`.
- The first run on a fresh machine takes several minutes (pip and npm installs). Use a long
  timeout (10 min) or run it in the background.
- **Restart** ("restart everything", or things look wrong after a `git pull`):
  `start-all.sh --restart`. **Stop**: `scripts/stop-all.sh`. **Check**: `scripts/status.sh`.
- Don't use Claude Code's `preview_start` for this. It caps at 5 servers, and there are ~31.
- From Git Bash, prefix `wsl` calls that contain `/` paths or `$(...)` with
  `MSYS_NO_PATHCONV=1`, or Git Bash will rewrite them. Complex shell logic is easiest to put
  in a script file and run with `wsl -d Ubuntu -- bash <file>`.

The one manual prerequisite on a brand-new machine is cloning this repo:
`git clone https://github.com/matthewnewell/conways-depot.git ~/conways-depot`. WSL also needs
`git`, `python3` with `python3-venv`, and Node via nvm. `bootstrap.sh` checks for these and says
what's missing. AI features also need `backend/.env`; bootstrap writes a template, and the key
comes from the user.

## Blank page, or "does not provide an export named …" in the console

This means a browser is holding an older `@conways/drawer` pre-bundle. Every app's
`vite.config.ts` includes `conwaysDrawer()` from `@conways/drawer/vite`, which changes Vite's
dependency URLs whenever the drawer's contents change. So `start-all.sh --restart` fixes it
without anyone clearing their browser cache. Keep that plugin in any new app's `vite.config.ts`.

## Changing demo data (any app's `seed.py`, or `backend/demo_data.py` here)

Bump `scripts/demo-data-version` (e.g. `2026-09-25.1` to `2026-09-25.2`, or today's date) in
the same commit. That's what makes every other machine reseed on its next "start all". On the
machine where you made the change, re-apply it by hand instead: for the Depot, run
`DATA_DIR=~/conways-depot/data backend/.venv/bin/python backend/refresh_demo.py`. Then copy the
new version into `data/.demo-data-version`, so start-all doesn't also reset that machine.

## Changing the shared drawer (`~/conways-drawer`)

Edit `src/`, run `npm run build` there, and commit both `src/` and `dist/` (`dist/` is tracked).
Then run `start-all.sh`: it detects the stale copies, refreshes them, and restarts the
frontends.
