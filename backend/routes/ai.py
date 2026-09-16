"""
Chat assist — same shape as Value Stream's: stateless (the frontend owns history, resending it
each call), context rebuilt fresh from the database every time so an edit mid-conversation shows
up in the next reply without restarting the chat.

The "insight" here is never AI-invented: every Conway/reverse-Conway/capability-gap signal below
is a plain, deterministic computation over the registry (a team owning N apps, a capability with
no built application). The AI's job is to explain and prioritize what the registry already
proves, not to guess at facts it wasn't given.

Third job, added later: one narrow, real write action — trigger Task Master's own "Suggest
backlog items" for the person chatting. Deliberately not a general tool-calling framework (that
would be the actually risky version); exactly one named action, reusing Task Master's existing
endpoint and its existing "lands marked ai_suggested, nothing moves itself" safety posture
unchanged. Real trigger: a user asked this chat to "review all my projects and make a backlog
of tasks in task master" and got told "I can't do that — Task Master is a personal tool, not a
project-wide one" — true on its face, but not the real reason (this chat had no write access to
anything, Task Master included) and actively wrong about the request itself: a personal backlog
spanning every project is exactly what Task Master is FOR, not a mismatch. See _SYSTEM_PROMPT's
own third job description for how that's framed to the model.
"""

import os
from collections import defaultdict

import httpx
from flask import Blueprint, jsonify, request

import ai_client
from models import PHASES, Application, Capability, Project

bp = Blueprint("ai", __name__, url_prefix="/api")

TASK_MASTER_API_URL = os.environ.get("TASK_MASTER_API_URL", "http://localhost:8100").rstrip("/")

SYSTEM_PROMPT = """You are the assistant embedded in Conway's Depot, a registry (not a
platform) that tracks three things: Projects (each with a single persistent id — its "digital
thread" — carried from Pursuit through Closeout), Applications (a catalog of domain apps, some
the org builds, some it buys), and Capabilities (the stable business need an application
fulfills, independent of which application currently fulfills it — the same split TOGAF's
Business Capability Map makes).

You have three jobs:

1. Structural analysis. Ground this in Conway's Law, the reverse Conway maneuver, and Team
   Topologies' vocabulary (stream-aligned / platform / enabling / complicated-subsystem team
   types) where relevant. Two signals below are the actual point of this tool — call them out
   when present, don't invent others:
     - a Capability with no Application registered against it (a real gap)
     - one team's name attached to an unusually large share of registered Applications (a
       possible Conway's-Law overload signal worth someone's attention)

2. "What app should I use for X?" When someone describes a need in plain language, recommend
   the 1-3 best-fitting Applications from the catalog below, each with a one-line reason tied
   to its actual description — never a generic "this seems related." An app with no live url is
   either not yet built or an external vendor tool the Depot doesn't host (its own description
   says which) — if it's the best fit, recommend it anyway with that caveat, don't silently
   prefer a worse-fitting live app just because it has a url. If nothing in the catalog actually
   fits, say so plainly — that's the same capability-gap signal from job 1, just discovered from
   a different angle — and don't force a recommendation to seem helpful.

3. One real action, and only this one: if the person chatting clearly asks you to review their
   own projects and add tasks to their own Task Master backlog, you can actually do it — Task
   Master is a PERSONAL, cross-project kanban by design (one backlog spanning every project a
   person supports, not a per-project board), so "review all my projects, make a backlog in
   Task Master" is exactly the shape Task Master exists for, not a mismatch to decline. Set
   `"action": "suggest_task_master_backlog"` when — and only when — they clearly asked for this;
   otherwise `"action": null`. This is a real, one-time action (creates real suggested cards,
   landing tagged ✨ Suggested, same as Task Master's own Suggest button — nothing moves itself
   further), not a simulation, so only trigger it on a clear ask, never proactively or as a
   guess at what might be helpful. You have no other write ability — if someone asks for
   anything else that would change data (in this registry or anywhere else), say plainly that
   you can't do that, because you don't have write access to it, not because the request itself
   doesn't make sense.

Never invent data not present in the context below — not a fourth app, not a capability that
isn't listed, not a description this catalog doesn't actually carry. If something isn't tracked
yet, say so plainly rather than guessing. Keep answers grounded, specific, and skeptical of
over-claiming — this tool exists to be a credible, minimal foundation, not a sales pitch.

Respond with ONLY this JSON shape:
{"reply": "your response to them, as plain conversational text",
 "action": "suggest_task_master_backlog" or null}"""


def _capability_gap_lines(capabilities: list[Capability], applications: list[Application]) -> list[str]:
    apps_by_cap: dict[str | None, list[Application]] = defaultdict(list)
    for a in applications:
        apps_by_cap[a.capability_id].append(a)

    lines = []
    for cap in capabilities:
        apps = apps_by_cap.get(cap.id, [])
        if apps:
            lines.append(f"  - \"{cap.name}\": {', '.join(a.name for a in apps)}.")
        else:
            lines.append(f"  - GAP — \"{cap.name}\": nothing registered against it.")
    return lines


def _app_catalog_lines(applications: list[Application]) -> list[str]:
    """One line per application — name, aisle(s), capability, built status, and its own
    description — the material a "what app should I use for X" recommendation actually needs.
    Separate from `_capability_gap_lines`, which is keyed by capability and only lists names;
    this is keyed by application and carries the description text that lets the assistant
    reason about *fit*, not just existence."""
    lines = []
    for a in sorted(applications, key=lambda a: a.name):
        cats = ", ".join(a.category_list) if a.category_list else "uncategorized"
        cap = a.capability.name if a.capability else "no capability on file"
        # `url` presence alone can't distinguish "not yet built" from "an external vendor tool
        # the Depot doesn't host" (both are just null) — the model documents this same
        # ambiguity in models.py. Don't assert either reading; the description text below
        # usually disambiguates ("Vendor tool, external..." vs "Not yet built —...").
        built = "has a live url" if a.url else "no url on file — check the description for why"
        desc = a.description or "no description on file"
        lines.append(f'  - "{a.name}" ({cats} · {cap} · {built}): {desc}')
    return lines


def _team_load_lines(applications: list[Application]) -> list[str]:
    by_team: dict[str, list[Application]] = defaultdict(list)
    for a in applications:
        if a.owning_team:
            by_team[a.owning_team].append(a)

    lines = []
    for team, apps in by_team.items():
        if len(apps) >= 2:
            lines.append(
                f"  - Conway signal: \"{team}\" owns {len(apps)} registered applications "
                f"({', '.join(a.name for a in apps)})."
            )
    return lines or ["  - No team currently owns more than one registered application."]


def _build_portfolio_context() -> str:
    projects = Project.query.all()
    applications = Application.query.all()
    capabilities = Capability.query.all()

    lines = ["=== Portfolio-wide context (no specific project selected) ==="]
    lines.append(f"{len(projects)} project(s) registered:")
    for p in projects:
        lines.append(f"  - {p.name} ({p.customer or 'no customer'}) — phase: {p.phase}")

    lines.append("\nCapability coverage:")
    lines.extend(_capability_gap_lines(capabilities, applications))

    lines.append("\nTeam ownership load:")
    lines.extend(_team_load_lines(applications))

    lines.append("\nApplication catalog (for \"what app should I use for X\" recommendations):")
    lines.extend(_app_catalog_lines(applications))

    return "\n".join(lines)


def _build_project_context(project: Project) -> str:
    lines = [
        "=== Project context ===",
        f"Name: {project.name}",
        f"Customer: {project.customer or 'none on file'}",
        f"Current phase: {project.phase}",
    ]
    if project.description:
        lines.append(f"Description: {project.description}")

    if project.external_ids:
        lines.append("External system IDs (crosswalk):")
        for e in project.external_ids:
            lines.append(f"  - {e.system}: {e.external_id}")
    else:
        lines.append("No external system IDs recorded yet.")

    if project.app_links:
        lines.append("Applications linked, by phase:")
        for phase in PHASES:
            phase_links = [l for l in project.app_links if l.phase == phase]
            if not phase_links:
                continue
            names = ", ".join(l.application.name for l in phase_links if l.application)
            lines.append(f"  - {phase}: {names}")
    else:
        lines.append("No applications linked to this project yet.")

    # The full catalog too, not just what's already linked — so "what should I add for X" can
    # be answered from inside a project's own chat, not only the portfolio-wide one.
    lines.append("\nFull application catalog (for \"what app should I use for X\" recommendations):")
    lines.extend(_app_catalog_lines(Application.query.all()))

    return "\n".join(lines)


def _trigger_task_master_suggest(person_id: str) -> str:
    """Calls Task Master's own POST /api/tasks/suggest — the exact same endpoint its own
    "Suggest backlog items" button calls, no new write path. Returns a plain, factual sentence
    to append to the reply — the actual outcome (how many cards, or what went wrong), computed
    here from Task Master's real response, never left to the model to claim on its own."""
    try:
        r = httpx.post(
            f"{TASK_MASTER_API_URL}/api/tasks/suggest",
            json={"person_id": person_id},
            timeout=30.0,
        )
    except httpx.HTTPError:
        return "(Couldn't reach Task Master to do this — it may not be running.)"

    if r.status_code != 201:
        try:
            err = r.json().get("error", "an unknown error")
        except ValueError:
            err = f"HTTP {r.status_code}"
        return f"(Task Master couldn't generate suggestions: {err})"

    created = r.json()
    if not created:
        return "(Looked, but nothing in your current projects warranted a new task right now.)"
    titles = "; ".join(t["title"] for t in created[:5])
    return f"(Done — added {len(created)} suggested card(s) to your Task Master backlog: {titles}.)"


@bp.post("/chat")
def chat():
    if not ai_client.is_configured():
        return jsonify({"reply": "", "error": ai_client.NOT_CONFIGURED_MESSAGE})

    body = request.get_json(force=True) or {}
    messages = body.get("messages") or []
    if not messages:
        return jsonify({"error": "messages is required"}), 400

    project_id = body.get("project_id")
    person_id = body.get("person_id")
    if project_id:
        project = Project.query.get(project_id)
        context = _build_project_context(project) if project else _build_portfolio_context()
    else:
        context = _build_portfolio_context()

    system = SYSTEM_PROMPT + "\n\n" + context
    result = ai_client.chat_json(messages, system=system, max_tokens=1024)
    if "error" in result:
        return jsonify({"reply": "", "error": result["error"]})

    reply = (result.get("reply") or "").strip()
    action_taken = False
    if result.get("action") == "suggest_task_master_backlog":
        if person_id:
            reply = f"{reply}\n\n{_trigger_task_master_suggest(person_id)}"
            action_taken = True
        else:
            reply = f"{reply}\n\n(Would do this, but I don't know who's asking — no persona is active.)"

    return jsonify({"reply": reply, "action_taken": action_taken})
