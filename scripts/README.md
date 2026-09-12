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
