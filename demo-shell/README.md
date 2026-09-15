# Demo Shell

A thin parent frame for demoing Conway's Depot alongside the sibling apps it links to (Value
Stream, and any other app reached from a project's connected-apps list). **Not part of any
app** — a presentation aid only, and the only piece of this ecosystem that lives *inside*
Conway's Depot's own repo rather than as its own sibling repo (see "Why it's here" below).

## What it does

`index.html` renders a fixed dark top bar above a full-height `<iframe>`. The bar **is the
Depot's navigation** when the Depot runs in the shell:

- **Conway's Depot** (top-left) → the splash / "what & why" page (`/about`)
- **Launchpad** → `/`   ·   **Projects** → `/projects`   ·   **Catalog** → `/catalog`
- **⚙ Admin** (far right) → `/admin`

Because the bar is the *parent* frame, it survives anything the framed page does — the
Depot's own routing, or a digital-thread link jumping straight into a Value Stream map or any
other connected app. Sibling apps are reached only through those in-project links; any bar
button brings the frame back to the Depot.

The sibling apps stay completely unaware they are being framed. The Depot cooperates via
`frontend/src/lib/embed.ts`: when it detects it is inside a frame it **hides its own
`<DepotNav>`** (the bar replaces it) and its outbound "Open →" links use `target="_self"` so
they stay in the iframe instead of opening a top-level tab that would escape the bar.
Standalone, `<DepotNav>` shows and links open a new tab as before.

## Why it's here

This directory used to be a standalone folder (`~/demo-shell`, no git repo of its own) —
`clone-all.sh` couldn't bring it along, so a fresh machine needed it copied over by hand.
Moved into `conways-depot/demo-shell/` (2026-09-15) so it ships with the Depot itself: `git
clone conways-depot` (or `scripts/clone-all.sh`) is now enough on its own.

## Run it

Open <http://localhost:5180> and demo from there instead of hitting `:5175` directly.

**The full ecosystem** — every sibling app's dev servers, including this shell — from
`conways-depot/scripts/start-all.sh` (run from a WSL terminal; `scripts/status.sh` shows
what's up, `scripts/stop-all.sh` tears it down). See `../scripts/README.md`.

**Just the shell + Depot + Value Stream** (five servers — the ceiling Claude Code's own
Browser-pane preview manager allows) — `demo.sh`, for a focused demo without the rest of the
ecosystem running:

```bash
/home/matthew/conways-depot/demo-shell/demo.sh          # start everything not already up
/home/matthew/conways-depot/demo-shell/demo.sh status   # what's listening
/home/matthew/conways-depot/demo-shell/demo.sh stop     # stop everything it started
/home/matthew/conways-depot/demo-shell/demo.sh restart
```

From Windows: `wsl -d Ubuntu -- /home/matthew/conways-depot/demo-shell/demo.sh`. Processes are
`setsid`-detached, so they survive the terminal closing. Logs land in `/tmp/demo-env/`. Value
Stream still needs to be cloned as a sibling under the same `$HOME` for its two entries to have
anything to start (`../scripts/clone-all.sh` handles that).

The shell alone is also **"Demo Shell"** in both `~/.claude/launch.json` (port 5180) and this
repo's own `.claude/launch.json`:
`python3 -m http.server 5180 --bind 0.0.0.0 --directory /home/matthew/conways-depot/demo-shell`
— no dependencies, no build. An app that isn't running just shows a connection error in the
frame.

## Notes

- `DEPOT` port in `index.html` must match the "Conway's Depot Frontend" entry in `launch.json`.
- Active-button highlight is best-effort: the shell knows where it *sent* the frame, but the
  Depot's in-frame navigation is cross-origin and unreadable, so "Launchpad" stays lit while
  you drill into a project or an app (still the right section, most of the time).
