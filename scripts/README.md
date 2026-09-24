# Ecosystem launcher scripts

Start, stop, and check every sibling app's dev server in one shot, run directly in your own
WSL terminal — deliberately outside Claude Code's Browser-pane preview manager, which caps at
5 concurrent servers per worktree (this ecosystem has more than 5 servers now).

```bash
scripts/start-all.sh   # starts every app in apps.sh that isn't already up
scripts/status.sh      # lists each app's port and up/down state
scripts/stop-all.sh    # stops everything start-all.sh started
```

Each app then runs at its usual port (see `apps.sh` or the root `.claude/launch.json`) — open
them in your own browser tabs. `start-all.sh` skips anything already listening on its port (so
it's safe to run again, and won't fight with a server you started through Claude Code's preview
tool or by hand), writes a pid file per app under `.run/` (gitignored), and logs each app's
output to `logs/<name>.log` (also gitignored).

**Adding a new app**: add one line to `apps.sh`'s `APPS` array — `name|port|cwd|command` — and
all three scripts pick it up.

## A new machine, or one that's fallen behind

```bash
git clone https://github.com/matthewnewell/conways-depot.git ~/conways-depot   # once, by hand
~/conways-depot/scripts/clone-all.sh        # every other repo, into $HOME
~/conways-depot/scripts/bootstrap.sh        # venvs, pip/npm installs, the shared drawer, .env template
~/conways-depot/scripts/start-all.sh        # run everything; status.sh to check
```

Everything lives directly under `$HOME` (`apps.sh` uses `$HOME`, so any WSL username works).
Each app seeds its demo data into an EMPTY database on first start.

**Already cloned there before?** Pull every repo, re-run `bootstrap.sh` (new dependencies),
then `scripts/reset-demo-data.sh`: an existing database never reseeds, so without it the old
demo data stays. It moves each app's database into `<app>/data-backup/<timestamp>/` (nothing is
deleted) and restarts everything so each app seeds fresh.

```bash
for d in ~/*/; do [ -d "$d/.git" ] && git -C "$d" pull --ff-only; done
~/conways-depot/scripts/bootstrap.sh
~/conways-depot/scripts/reset-demo-data.sh
```
