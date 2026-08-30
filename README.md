# Conway's Depot

A registry — not a platform — for tracking the domain applications an organization builds
(value-stream mapping, EVM tracking, capture, SOW, CAPA, staffing, …) and the projects they
serve, tied together by one persistent id per project (its "digital thread") instead of a
shared database or a live API mesh.

Read the app's own [Theory of Operation](#) page (`/guide` once running) for the full
reasoning — it's grounded in Conway's Law, the reverse Conway maneuver, Team Topologies,
TOGAF's Business Capability Map, and the PMI/DoD "digital thread" concept, not invented
vocabulary.

## What it holds

- **Project** — one id, a name, a customer, and a `phase` (Pursuit → Award → Execution →
  Closeout). Accumulates `ExternalId` crosswalk entries (a WinMax opportunity number, a
  Costpoint charge number) as it moves through real systems — the Depot's own id never gets
  replaced by one of them.
- **Application** — a catalog entry: `built`, `planned`, or `external` (a real vendor product
  registered but never integrated with), an owning team, a Team Topologies team type, and the
  Capability it fulfills.
- **Capability** — the stable business need (TOGAF-style) an Application currently fulfills.
  Swap the application later; the capability and every project's history stay put.
- **ProjectAppLink** — the only "integration" the Depot performs: a plain pointer (an id
  and/or URL) saying this project has a record in this application, at this phase. Never a
  live API call.

## Stack

Same conventions as the sibling apps (Value Stream, BurnedValue): Flask + SQLAlchemy + SQLite
backend, React + TypeScript + Vite frontend, AI chat assist optional and off by default
(`AI_PROVIDER=none`).

## Running locally

```bash
# Backend (port 8090)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python app.py

# Frontend (port 5175), separate terminal
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5175`. The database seeds itself on first run: the Application catalog
comes seeded with real sibling apps (Value Stream, BurnedValue), real external vendor stubs
(WinMax, Costpoint), and a few honestly-labeled `planned` placeholders (Project Launchpad, SOW
Tracker, CAPA App, Staffing & Capacity Engine). One demo project ties them together across
phases — its Execution-phase link points at Value Stream's own real seeded demo map, so it's a
genuine clickable connection between two independently-running apps, not a mockup (only works
if Value Stream's dev server is also running on `:5173`).

Set `AI_PROVIDER=claude|gemini|ollama` (plus `AI_API_KEY`/`AI_MODEL` as needed) to enable the
chat assistant. Every insight it can give you — capability gaps, team-ownership load — is
computed deterministically first; the AI's job is to explain what the registry already proves,
never to invent data.

## Explicitly not here yet

No live integration with WinMax, Costpoint, or anything else. No staffing/capacity math — that
capability is registered as `planned` on purpose, because it's a real, hard problem that
deserves its own project. No auth, no permissions, no enforcement. This is scaffolding sized to
prove the shape is right before anything heavier gets built on it.
